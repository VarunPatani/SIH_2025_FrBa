# # app/allocation.py

# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import text, bindparam
# import math, json
# from typing import List, Optional
# from collections import defaultdict


# # ---------- Utility Functions ----------
# def norm(x, lo, hi):
#     if x is None:
#         return 0.0
#     if hi == lo:
#         return 0.0
#     return max(0.0, min(1.0, (x - lo) / (hi - lo)))


# def jaccard(text_a: str, text_b: str) -> float:
#     """Simple Jaccard similarity on whitespace/comma tokens"""
#     if not text_a or not text_b:
#         return 0.0
#     A = set(w.strip().lower() for w in text_a.replace(",", " ").split())
#     B = set(w.strip().lower() for w in text_b.replace(",", " ").split())
#     if not A or not B:
#         return 0.0
#     return len(A & B) / len(A | B)


# # ---------- Core Allocation ----------
# async def run_allocation(
#     db: AsyncSession,
#     scope_emails: Optional[List[str]] = None,
#     respect_existing: bool = True,
#     skill_weight: float = 0.65,
#     location_weight: float = 0.20,
#     cgpa_weight: float = 0.15,
# ):
#     """
#     Incremental allocation:
#       - If respect_existing=True: freeze last successful run's matches, reduce internship capacity.
#       - If scope_emails provided: only consider those students for new allocation.
#     Returns: run_id
#     """

#     # 1. Latest successful run
#     latest_run_id = (await db.execute(text("""
#         SELECT run_id FROM alloc_run
#         WHERE status='SUCCESS'
#         ORDER BY created_at DESC
#         LIMIT 1
#     """))).scalar()

#     # 2. Freeze existing placements
#     frozen_students = set()
#     used_by_internship = defaultdict(int)

#     rows = (await db.execute(text("""
#         SELECT mr.student_id, mr.internship_id
#         FROM match_result mr
#         JOIN alloc_run ar ON ar.run_id = mr.run_id
#         WHERE ar.status = 'SUCCESS'
#     """))).mappings().all()

#     for r in rows:
#         frozen_students.add(int(r["student_id"]))
#         used_by_internship[int(r["internship_id"])] += 1

#     # 3. Load internships and remaining capacity
#     jobs = (await db.execute(text("""
#         SELECT i.internship_id, i.title, i.location, i.pincode, i.capacity,
#                i.req_skills_text, i.min_cgpa
#         FROM internship i
#         WHERE i.is_active = true
#     """))).mappings().all()

#     job_info = {}
#     for j in jobs:
#         iid = int(j["internship_id"])
#         cap = int(j["capacity"])
#         rem = cap - used_by_internship.get(iid, 0)
#         if rem <= 0:
#             rem = 0
#         job_info[iid] = {
#             "title": j["title"],
#             "location": j["location"],
#             "pincode": j["pincode"],
#             "capacity": cap,
#             "remaining": rem,
#             "req_skills_text": j["req_skills_text"] or "",
#             "min_cgpa": float(j["min_cgpa"] or 0.0),
#         }

#     # 4. Build WHERE conditions for students
#     where = ["1=1"]
#     params = {}

#     scope_emails = [e.strip() for e in (scope_emails or []) if e and e.strip()]
#     if scope_emails:
#         where.append("s.email IN :emails")
#         params["emails"] = tuple(scope_emails)

#     if frozen_students:
#         where.append("s.student_id NOT IN :frozen")
#         params["frozen"] = tuple(frozen_students)

#     # short-circuit if scope provided but ended up empty
#     if ("emails" in params) and not params["emails"]:
#         rid = (await db.execute(text("""
#             INSERT INTO alloc_run (status, params_json, metrics_json)
#             VALUES ('SUCCESS',
#                     JSON_OBJECT('respect_existing', :re, 'scoped', 1, 'note','empty scope'),
#                     NULL)
#         """), {"re": 1 if respect_existing else 0})).lastrowid
#         await db.commit()
#         return int(rid)

#     # 5. Fetch eligible students
#     sel = text(f"""
#         SELECT s.student_id, s.name, s.email, s.cgpa, s.location_pref, s.skills_text
#         FROM student s
#         WHERE {" AND ".join(where)}
#     """)

#     if "emails" in params:
#         sel = sel.bindparams(bindparam("emails", expanding=True))
#     if "frozen" in params:
#         sel = sel.bindparams(bindparam("frozen", expanding=True))

#     students = (await db.execute(sel, params)).mappings().all()

#     if not students:
#         rid = (await db.execute(text("""
#             INSERT INTO alloc_run (status, params_json, metrics_json)
#             VALUES ('SUCCESS',
#                     JSON_OBJECT('respect_existing', :re, 'scoped', :sc),
#                     JSON_OBJECT('note','no eligible students in scope'))
#         """), {"re": 1 if respect_existing else 0, "sc": 1 if bool(scope_emails) else 0})).lastrowid
#         await db.commit()
#         return int(rid)

#     # 6. Filter open jobs
#     open_jobs = [jid for jid, info in job_info.items() if info["remaining"] > 0]
#     if not open_jobs:
#         rid = (await db.execute(text("""
#             INSERT INTO alloc_run (status, params_json, metrics_json)
#             VALUES ('SUCCESS',
#                     JSON_OBJECT('respect_existing', :re, 'scoped', :sc),
#                     JSON_OBJECT('note','no open capacity'))
#         """), {"re": 1 if respect_existing else 0, "sc": 1 if bool(scope_emails) else 0})).lastrowid
#         await db.commit()
#         return int(rid)

#     # 7. Score student-job pairs
#     pairs = []
#     for s in students:
#         for jid in open_jobs:
#             j = job_info[jid]
#             if j["remaining"] <= 0:
#                 continue
#             # eligibility check
#             cg_ok = (s["cgpa"] is None) or (float(s["cgpa"]) >= j["min_cgpa"])
#             if not cg_ok:
#                 continue

#             sem = jaccard(s["skills_text"] or "", j["req_skills_text"])
#             cg = norm(float(s["cgpa"]) if s["cgpa"] is not None else 0.0, 6.0, 9.5) if j["min_cgpa"] > 0 else 0.0
#             loc = 1.0 if (s["location_pref"] and j["location"] and s["location_pref"].lower() == j["location"].lower()) else 0.0

#             score = skill_weight * sem + location_weight * loc + cgpa_weight * cg
#             if score <= 0:
#                 continue

#             pairs.append((score, int(s["student_id"]), int(jid), {
#                 "semantic": round(sem, 4),
#                 "location": loc,
#                 "cgpa_norm": round(cg, 4),
#                 "weights": {"sem": 0.65, "loc": 0.20, "cg": 0.15}
#             }))

#     pairs.sort(reverse=True, key=lambda x: x[0])

#     # 8. Greedy allocation
#     assigned = {}
#     remaining = {jid: job_info[jid]["remaining"] for jid in open_jobs}

#     for score, sid, jid, comp in pairs:
#         if sid in assigned:
#             continue
#         if remaining.get(jid, 0) <= 0:
#             continue
#         assigned[sid] = (jid, score, comp)
#         remaining[jid] -= 1

#     # 9. Record run + matches
#     params_json = json.dumps({
#         'respect_existing': 1 if respect_existing else 0,
#         'scoped': 1 if bool(scope_emails) else 0, 
#         'frozen_count': len(frozen_students),
#         'weights': {
#             'skill': skill_weight,
#             'location': location_weight,
#             'cgpa': cgpa_weight
#         },
#         'algorithm': 'greedy'
#     })
    
#     result = await db.execute(text("""
#         INSERT INTO alloc_run (status, params_json, metrics_json)
#         VALUES ('SUCCESS', :params_json, NULL)
#         RETURNING run_id
#     """), {
#         "params_json": params_json
#     })
    
#     rid = result.scalar_one()
#     if assigned:
#         rows = []
#         for sid, (jid, score, comp) in assigned.items():
#             rows.append({
#                 "run_id": int(rid),
#                 "student_id": sid,
#                 "internship_id": jid,
#                 "final_score": float(round(score, 4)),
#                 "component_json": json.dumps(comp),
#             })
        
#         # Execute the inserts one by one to avoid issues with bulk insert
#         for row in rows:
#             await db.execute(text("""
#                 INSERT INTO match_result
#                   (run_id, student_id, internship_id, final_score, component_json)
#                 VALUES
#                   (:run_id, :student_id, :internship_id, :final_score, :component_json)
#             """), row)

#     await db.commit()
#     return int(rid)

# app/allocation.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, bindparam
import math, json
from typing import List, Optional
from collections import defaultdict
import numpy as np
from scipy.optimize import linear_sum_assignment


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
    Optimal allocation using Hungarian algorithm:
      - If respect_existing=True: freeze last successful run's matches.
      - If scope_emails provided: only consider those students for new allocation.
    Returns: run_id
    """

    # 1. Freeze existing placements
    frozen_students = set()
    used_by_internship = defaultdict(int)

    rows = (await db.execute(text("""
        SELECT mr.student_id, mr.internship_id
        FROM match_result mr
        JOIN alloc_run ar ON ar.run_id = mr.run_id
        WHERE ar.status = 'SUCCESS'
    """))).mappings().all()

    for r in rows:
        frozen_students.add(int(r["student_id"]))
        used_by_internship[int(r["internship_id"])] += 1

    # 2. Load internships and remaining capacity
    jobs = (await db.execute(text("""
        SELECT i.internship_id, i.title, i.location, i.pincode, i.capacity,
               i.req_skills_text, i.min_cgpa
        FROM internship i
        WHERE i.is_active = true
    """))).mappings().all()

    job_slots = []  # (jid, slot_index)
    job_info = {}
    for j in jobs:
        iid = int(j["internship_id"])
        cap = int(j["capacity"])
        rem = cap - used_by_internship.get(iid, 0)
        if rem > 0:
            for k in range(rem):
                job_slots.append((iid, k))
        job_info[iid] = {
            "title": j["title"],
            "location": j["location"],
            "pincode": j["pincode"],
            "capacity": cap,
            "remaining": rem,
            "req_skills_text": j["req_skills_text"] or "",
            "min_cgpa": float(j["min_cgpa"] or 0.0),
        }

    if not job_slots:
        rid = (await db.execute(text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    JSON_OBJECT('note','no open capacity'),
                    NULL)
            RETURNING run_id
        """))).scalar_one()
        await db.commit()
        return int(rid)

    # 3. Load eligible students
    where = ["1=1"]
    params = {}

    scope_emails = [e.strip() for e in (scope_emails or []) if e and e.strip()]
    if scope_emails:
        where.append("s.email IN :emails")
        params["emails"] = tuple(scope_emails)

    if frozen_students:
        where.append("s.student_id NOT IN :frozen")
        params["frozen"] = tuple(frozen_students)

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
        rid = (await db.execute(text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    JSON_OBJECT('note','no eligible students'),
                    NULL)
            RETURNING run_id
        """))).scalar_one()
        await db.commit()
        return int(rid)

    # 4. Build score matrix (students × job_slots)
    S = len(students)
    J = len(job_slots)
    score_matrix = np.zeros((S, J))
    components = {}

    for si, s in enumerate(students):
        for ji, (jid, _) in enumerate(job_slots):
            j = job_info[jid]

            # eligibility
            cg_ok = (s["cgpa"] is None) or (float(s["cgpa"]) >= j["min_cgpa"])
            if not cg_ok:
                score = 0.0
            else:
                sem = jaccard(s["skills_text"] or "", j["req_skills_text"])
                cg = norm(float(s["cgpa"]) if s["cgpa"] else 0.0, 6.0, 9.5) if j["min_cgpa"] > 0 else 0.0
                loc = 1.0 if (s["location_pref"] and j["location"] and s["location_pref"].lower() == j["location"].lower()) else 0.0
                score = skill_weight * sem + location_weight * loc + cgpa_weight * cg

            score_matrix[si, ji] = score
            components[(s["student_id"], jid, ji)] = {
                "semantic": float(round(sem, 4)) if cg_ok else 0.0,
                "location": float(loc) if cg_ok else 0.0,
                "cgpa_norm": float(round(cg, 4)) if cg_ok else 0.0,
                "weights": {"skill": skill_weight, "location": location_weight, "cgpa": cgpa_weight},
            }

    # 5. Run Hungarian (maximize score = minimize cost)
    max_score = np.max(score_matrix) if score_matrix.size > 0 else 1.0
    cost_matrix = max_score - score_matrix
    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    # 6. Save run
    params_json = json.dumps({
        'respect_existing': 1 if respect_existing else 0,
        'scoped': 1 if bool(scope_emails) else 0,
        'frozen_count': len(frozen_students),
        'weights': {
            'skill': skill_weight,
            'location': location_weight,
            'cgpa': cgpa_weight
        },
        'algorithm': 'hungarian'
    })
    result = await db.execute(text("""
        INSERT INTO alloc_run (status, params_json, metrics_json)
        VALUES ('SUCCESS', :params_json, NULL)
        RETURNING run_id
    """), {"params_json": params_json})
    rid = result.scalar_one()

    # 7. Save matches
    for si, sj in zip(row_ind, col_ind):
        sid = int(students[si]["student_id"])
        jid, _ = job_slots[sj]
        score = float(round(score_matrix[si, sj], 4))
        if score <= 0:  # skip invalid matches
            continue

        comp = components[(sid, jid, sj)]
        await db.execute(text("""
            INSERT INTO match_result
              (run_id, student_id, internship_id, final_score, component_json)
            VALUES
              (:run_id, :student_id, :internship_id, :final_score, :component_json)
        """), {
            "run_id": rid,
            "student_id": sid,
            "internship_id": jid,
            "final_score": score,
            "component_json": json.dumps(comp),
        })

    await db.commit()
    return int(rid)