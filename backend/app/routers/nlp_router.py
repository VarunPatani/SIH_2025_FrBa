from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, bindparam
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
import numpy as np
from collections import defaultdict

from ..db import get_db
from ..nlp_matching_glove import (
    glove_similarity,
    glove_comprehensive_similarity, 
    get_cached_glove_model,
    get_config_value
)

router = APIRouter(prefix="/allocation/nlp", tags=["allocation"])

class NLPAllocationRequest(BaseModel):
    emails: Optional[List[str]] = Field(None, description="Limit allocation to these students (optional)")
    respect_existing: bool = Field(True, description="Respect existing allocations")
    skill_weight: Optional[float] = Field(0.65, description="Weight for skill matching")
    location_weight: Optional[float] = Field(0.20, description="Weight for location matching")
    cgpa_weight: Optional[float] = Field(0.15, description="Weight for CGPA matching")

class NLPAllocationResponse(BaseModel):
    run_id: int
    message: str
    match_count: int = 0
    students_matched: int = 0
    internships_matched: int = 0

async def run_nlp_allocation(
    db: AsyncSession,
    scope_emails: Optional[List[str]] = None,
    respect_existing: bool = True,
    skill_weight: float = 0.65,
    location_weight: float = 0.20,
    cgpa_weight: float = 0.15,
):
    """
    Allocation using NLP-based GloVe matching:
      - If respect_existing=True: freeze last successful run's matches, reduce internship capacity.
      - If scope_emails provided: only consider those students for new allocation.
    Returns: run_id
    """
    # 1. Latest successful run
    latest_run_id = (await db.execute(text("""
        SELECT run_id FROM alloc_run
        WHERE status='SUCCESS'
        ORDER BY created_at DESC
        LIMIT 1
    """))).scalar()

    # 2. Freeze existing placements
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

    # 3. Load internships and remaining capacity
    jobs = (await db.execute(text("""
        SELECT i.internship_id, i.title, i.location, i.pincode, i.capacity,
               i.req_skills_text, i.min_cgpa
        FROM internship i
        WHERE i.is_active = true
    """))).mappings().all()

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
        rid = (await db.execute(text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    json_build_object('respect_existing', :re, 'scoped', 1, 'note','empty scope', 'algorithm', 'nlp_glove'),
                    NULL)
        """), {"re": 1 if respect_existing else 0})).lastrowid
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
        rid = (await db.execute(text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    json_build_object('respect_existing', :re, 'scoped', :sc, 'algorithm', 'nlp_glove'),
                    json_build_object('note','no eligible students in scope'))
        """), {"re": 1 if respect_existing else 0, "sc": 1 if bool(scope_emails) else 0})).lastrowid
        await db.commit()
        return int(rid)

    # 6. Filter open jobs
    open_jobs = [jid for jid, info in job_info.items() if info["remaining"] > 0]
    if not open_jobs:
        rid = (await db.execute(text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    json_build_object('respect_existing', :re, 'scoped', :sc, 'algorithm', 'nlp_glove'),
                    json_build_object('note','no open capacity'))
        """), {"re": 1 if respect_existing else 0, "sc": 1 if bool(scope_emails) else 0})).lastrowid
        await db.commit()
        return int(rid)

    # 7. Score student-job pairs with NLP GloVe
    pairs = []
    for s in students:
        for jid in open_jobs:
            j = job_info[jid]
            if j["remaining"] <= 0:
                continue
            
            # Eligibility check
            cg_ok = (s["cgpa"] is None) or (float(s["cgpa"]) >= j["min_cgpa"])
            if not cg_ok:
                continue
            
            # Calculate NLP-based comprehensive score
            score, components = glove_comprehensive_similarity(
                s["skills_text"] or "", 
                j["req_skills_text"],
                s["location_pref"] or "", 
                j["location"] or "",
                float(s["cgpa"] or 0.0), 
                j["min_cgpa"],
                skill_weight,
                location_weight,
                cgpa_weight
            )
            
            # Only consider scores above a minimum threshold
            if score >= 0.2:  # Minimum threshold
                pairs.append((score, int(s["student_id"]), int(jid), components))

    # Sort by score (descending)
    pairs.sort(reverse=True, key=lambda x: x[0])
    
    # 8. Greedy allocation
    assigned = {}
    remaining = {jid: job_info[jid]["remaining"] for jid in open_jobs}

    for score, sid, jid, comp in pairs:
        if sid in assigned:
            continue
        if remaining.get(jid, 0) <= 0:
            continue
        assigned[sid] = (jid, score, comp)
        remaining[jid] -= 1

    # 9. Record run + matches
    params_json = json.dumps({
        'respect_existing': 1 if respect_existing else 0,
        'scoped': 1 if bool(scope_emails) else 0, 
        'frozen_count': len(frozen_students),
        'weights': {
            'skill': skill_weight,
            'location': location_weight,
            'cgpa': cgpa_weight
        },
        'algorithm': 'nlp_glove'
    })
    
    metrics_json = json.dumps({
        'total_students': len(students),
        'total_jobs': len(open_jobs),
        'matches_found': len(assigned),
        'avg_score': sum(score for _, score, _ in assigned.values()) / len(assigned) if assigned else 0
    })
    
    result = await db.execute(text("""
        INSERT INTO alloc_run (status, params_json, metrics_json)
        VALUES ('SUCCESS', :params_json, :metrics_json)
        RETURNING run_id
    """), {
        "params_json": params_json,
        "metrics_json": metrics_json
    })
    
    rid = result.scalar_one()
    
    if assigned:
        rows = []
        for sid, (jid, score, comp) in assigned.items():
            rows.append({
                "run_id": int(rid),
                "student_id": sid,
                "internship_id": jid,
                "final_score": float(round(score, 4)),
                "component_json": json.dumps(comp),
            })
        
        # Execute the inserts one by one to avoid issues with bulk insert
        for row in rows:
            await db.execute(text("""
                INSERT INTO match_result
                  (run_id, student_id, internship_id, final_score, component_json)
                VALUES
                  (:run_id, :student_id, :internship_id, :final_score, :component_json)
            """), row)

    await db.commit()
    return int(rid)

@router.post("/run", response_model=NLPAllocationResponse)
async def run_allocation(
    request: NLPAllocationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger a new NLP-based allocation run with optional configuration parameters
    """
    try:
        run_id = await run_nlp_allocation(
            db=db,
            scope_emails=request.emails,
            respect_existing=request.respect_existing,
            skill_weight=request.skill_weight,
            location_weight=request.location_weight,
            cgpa_weight=request.cgpa_weight
        )
        
        # Get summary stats
        query = text("""
            SELECT 
                COUNT(*) as match_count,
                COUNT(DISTINCT student_id) as students_matched,
                COUNT(DISTINCT internship_id) as internships_matched
            FROM match_result
            WHERE run_id = :run_id
        """)
        
        result = await db.execute(query, {"run_id": run_id})
        stats = result.mappings().first()
        
        return {
            "run_id": run_id,
            "message": "NLP-based allocation completed successfully",
            "match_count": stats["match_count"] if stats else 0,
            "students_matched": stats["students_matched"] if stats else 0,
            "internships_matched": stats["internships_matched"] if stats else 0
        }
        
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"NLP Allocation error: {str(e)}")
        print(error_details)
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"NLP allocation failed: {str(e)}"
        )