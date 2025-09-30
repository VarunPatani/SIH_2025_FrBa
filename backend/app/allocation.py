# app/allocation.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, bindparam
import math, json
import numpy as np
from scipy.optimize import linear_sum_assignment
from typing import List, Optional
from collections import defaultdict


# ---------- Utility Functions ----------
def norm(x, lo, hi):
    if x is None:
        return 0.0
    if hi == lo:
        return 0.0
    return max(0.0, min(1.0, (x - lo) / (hi - lo)))


def jaccard(text_a: str, text_b: str) -> float:
    """Simple Jaccard similarity on whitespace/comma tokens"""
    if not text_a or not text_b:
        return 0.0
    A = set(w.strip().lower() for w in text_a.replace(",", " ").split())
    B = set(w.strip().lower() for w in text_b.replace(",", " ").split())
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)


# ---------- Core Allocation ----------
async def run_allocation(
    db: AsyncSession,
    scope_emails: Optional[List[str]] = None,
    respect_existing: bool = True,
    skill_weight: float = 0.65,
    location_weight: float = 0.20,
    cgpa_weight: float = 0.15,
):
    """
    Incremental allocation using Hungarian method for optimal assignment:
      - If respect_existing=True: freeze last successful run's matches, reduce internship capacity.
      - If scope_emails provided: only consider those students for new allocation.
    Returns: run_id
    """

    # 1. Latest successful run
    latest_run_id = (
        await db.execute(
            text("""
        SELECT run_id FROM alloc_run
        WHERE status='SUCCESS'
        ORDER BY created_at DESC
        LIMIT 1
    """)
        )
    ).scalar()

    # 2. Freeze existing placements
    frozen_students = set()
    used_by_internship = defaultdict(int)

    rows = (
        (
            await db.execute(
                text("""
        SELECT mr.student_id, mr.internship_id
        FROM match_result mr
        JOIN alloc_run ar ON ar.run_id = mr.run_id
        WHERE ar.status = 'SUCCESS'
    """)
            )
        )
        .mappings()
        .all()
    )

    for r in rows:
        frozen_students.add(int(r["student_id"]))
        used_by_internship[int(r["internship_id"])] += 1

    # 3. Load internships and remaining capacity
    jobs = (
        (
            await db.execute(
                text("""
        SELECT i.internship_id, i.title, i.location, i.pincode, i.capacity,
               i.req_skills_text, i.min_cgpa
        FROM internship i
        WHERE i.is_active = true
    """)
            )
        )
        .mappings()
        .all()
    )

    job_info = {}
    for j in jobs:
        iid = int(j["internship_id"])
        cap = int(j["capacity"])
        rem = cap - used_by_internship.get(iid, 0)
        if rem <= 0:
            rem = 0
        job_info[iid] = {
            "title": j["title"],
            "location": j["location"],
            "pincode": j["pincode"],
            "capacity": cap,
            "remaining": rem,
            "req_skills_text": j["req_skills_text"] or "",
            "min_cgpa": float(j["min_cgpa"] or 0.0),
        }

    # 4. Build WHERE conditions for students
    where = ["1=1"]
    params = {}

    scope_emails = [e.strip() for e in (scope_emails or []) if e and e.strip()]
    if scope_emails:
        where.append("s.email IN :emails")
        params["emails"] = tuple(scope_emails)

    if frozen_students and respect_existing:
        where.append("s.student_id NOT IN :frozen")
        params["frozen"] = tuple(frozen_students)

    # short-circuit if scope provided but ended up empty
    if ("emails" in params) and not params["emails"]:
        rid = (
            await db.execute(
                text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    JSON_OBJECT('respect_existing', :re, 'scoped', 1, 'note','empty scope', 'algorithm', 'hungarian'),
                    NULL)
        """),
                {"re": 1 if respect_existing else 0},
            )
        ).lastrowid
        await db.commit()
        return int(rid)

    # 5. Fetch eligible students
    sel = text(f"""
        SELECT s.student_id, s.name, s.email, s.cgpa, s.location_pref, s.skills_text
        FROM student s
        WHERE {" AND ".join(where)}
    """)

    if "emails" in params:
        sel = sel.bindparams(bindparam("emails", expanding=True))
    if "frozen" in params:
        sel = sel.bindparams(bindparam("frozen", expanding=True))

    students = (await db.execute(sel, params)).mappings().all()

    if not students:
        rid = (
            await db.execute(
                text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    JSON_OBJECT('respect_existing', :re, 'scoped', :sc, 'algorithm', 'hungarian'),
                    JSON_OBJECT('note','no eligible students in scope'))
        """),
                {
                    "re": 1 if respect_existing else 0,
                    "sc": 1 if bool(scope_emails) else 0,
                },
            )
        ).lastrowid
        await db.commit()
        return int(rid)

    # 6. Filter open jobs and create job slots
    open_jobs = [jid for jid, info in job_info.items() if info["remaining"] > 0]
    if not open_jobs:
        rid = (
            await db.execute(
                text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    JSON_OBJECT('respect_existing', :re, 'scoped', :sc, 'algorithm', 'hungarian'),
                    JSON_OBJECT('note','no open capacity'))
        """),
                {
                    "re": 1 if respect_existing else 0,
                    "sc": 1 if bool(scope_emails) else 0,
                },
            )
        ).lastrowid
        await db.commit()
        return int(rid)

    # Create job slots (expand each job into multiple slots based on capacity)
    job_slots = []  # (job_id, slot_index)
    for jid in open_jobs:
        remaining = job_info[jid]["remaining"]
        for slot in range(remaining):
            job_slots.append((jid, slot))

    # 7. Build cost matrix for Hungarian algorithm
    S = len(students)  # Number of students
    J = len(job_slots)  # Number of job slots

    # Create a matrix of the right size for the Hungarian algorithm
    # If more students than jobs, we add dummy jobs
    # If more jobs than students, we add dummy students
    padded_size = max(S, J)
    score_matrix = np.zeros((padded_size, padded_size))

    # Fill the matrix with scores (only the real student-job pairs)
    for i, student in enumerate(students):
        for j, (jid, _) in enumerate(job_slots):
            job = job_info[jid]

            # eligibility check
            cg_ok = (student["cgpa"] is None) or (
                float(student["cgpa"]) >= job["min_cgpa"]
            )
            if not cg_ok:
                continue  # Leave as 0 (not eligible)

            sem = jaccard(student["skills_text"] or "", job["req_skills_text"])
            cg = (
                norm(
                    float(student["cgpa"] if student["cgpa"] is not None else 0.0),
                    6.0,
                    9.5,
                )
                if job["min_cgpa"] > 0
                else 0.0
            )
            loc = (
                1.0
                if (
                    student["location_pref"]
                    and job["location"]
                    and student["location_pref"].lower() == job["location"].lower()
                )
                else 0.0
            )

            score = skill_weight * sem + location_weight * loc + cgpa_weight * cg
            score_matrix[i, j] = score

    # Convert to cost matrix (Hungarian algorithm minimizes costs)
    max_score = (
        np.max(score_matrix)
        if score_matrix.size > 0 and np.max(score_matrix) > 0
        else 1.0
    )
    cost_matrix = max_score - score_matrix

    # Run the Hungarian algorithm
    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    # 8. Extract matches from Hungarian results
    assigned = {}
    for i, j in zip(row_ind, col_ind):
        # Skip dummy assignments or invalid indices
        if i >= S or j >= J:
            continue

        # Skip assignments with zero or negative score
        score = score_matrix[i, j]
        if score <= 0:
            continue

        sid = int(students[i]["student_id"])
        jid = job_slots[j][0]  # Get the actual job ID from the slot

        student = students[i]
        job = job_info[jid]

        # Calculate components for record keeping (same as before)
        sem = jaccard(student["skills_text"] or "", job["req_skills_text"])
        cg = (
            norm(
                float(student["cgpa"] if student["cgpa"] is not None else 0.0), 6.0, 9.5
            )
            if job["min_cgpa"] > 0
            else 0.0
        )
        loc = (
            1.0
            if (
                student["location_pref"]
                and job["location"]
                and student["location_pref"].lower() == job["location"].lower()
            )
            else 0.0
        )

        comp = {
            "semantic": round(sem, 4),
            "location": loc,
            "cgpa_norm": round(cg, 4),
            "weights": {"sem": skill_weight, "loc": location_weight, "cg": cgpa_weight},
        }

        assigned[sid] = (jid, float(score), comp)

    # 9. Record run + matches (same DB operations as before)
    params_json = json.dumps(
        {
            "respect_existing": 1 if respect_existing else 0,
            "scoped": 1 if bool(scope_emails) else 0,
            "frozen_count": len(frozen_students),
            "weights": {
                "skill": skill_weight,
                "location": location_weight,
                "cgpa": cgpa_weight,
            },
            "algorithm": "hungarian",
        }
    )

    result = await db.execute(
        text("""
        INSERT INTO alloc_run (status, params_json, metrics_json)
        VALUES ('SUCCESS', :params_json, NULL)
        RETURNING run_id
    """),
        {"params_json": params_json},
    )

    rid = result.scalar_one()
    if assigned:
        rows = []
        for sid, (jid, score, comp) in assigned.items():
            rows.append(
                {
                    "run_id": int(rid),
                    "student_id": sid,
                    "internship_id": jid,
                    "final_score": float(round(score, 4)),
                    "component_json": json.dumps(comp),
                }
            )

        # Execute the inserts one by one to avoid issues with bulk insert
        for row in rows:
            await db.execute(
                text("""
                INSERT INTO match_result
                  (run_id, student_id, internship_id, final_score, component_json)
                VALUES
                  (:run_id, :student_id, :internship_id, :final_score, :component_json)
            """),
                row,
            )

    await db.commit()
    return int(rid)
