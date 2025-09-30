import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, bindparam
from typing import List, Dict, Optional, Tuple, Any
import numpy as np
from collections import defaultdict

# Import both allocation systems
from .allocation import norm, jaccard
from .nlp_matching_glove import (
    glove_similarity, 
    glove_comprehensive_similarity, 
    get_cached_glove_model,
    get_config_value
)

# ---------- Ensemble Configuration ----------
class EnsembleConfig:
    def __init__(self):
        self.config = {
            # Ensemble method: 'weighted', 'max_score', 'voting'
            "ensemble_method": "weighted",
            
            # Weights for different allocation methods
            "method_weights": {
                "traditional": 0.4,
                "glove": 0.6
            },
            
            # Score threshold for considering a match viable
            "min_score_threshold": 0.2,
            
            # Whether to use comprehensive GloVe matching
            "use_comprehensive_glove": True,
            
            # Weights for components in traditional matching
            "traditional_weights": {
                "skill_weight": 0.65,
                "location_weight": 0.20,
                "cgpa_weight": 0.15
            },
            
            # Weights for components in GloVe matching
            "glove_weights": {
                "skill_weight": 0.65,
                "location_weight": 0.20,
                "cgpa_weight": 0.15
            },
            
            # Settings for validation step
            "validation": {
                "enabled": True,
                "min_skill_match": 0.15,
                "min_location_match": 0.0
            }
        }
    
    def get(self, key, default=None):
        """Get a configuration value with dot notation support"""
        keys = key.split('.')
        value = self.config
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default
    
    def update(self, key, value):
        """Update a configuration value with dot notation support"""
        keys = key.split('.')
        config = self.config
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        config[keys[-1]] = value

# Global ensemble configuration
ensemble_config = EnsembleConfig()

# ---------- Traditional Scoring ----------
def traditional_score(
    student_skills: str, 
    required_skills: str,
    student_location: str,
    job_location: str,
    student_cgpa: float,
    job_min_cgpa: float,
    weights: Optional[Dict[str, float]] = None
) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate traditional matching score using Jaccard similarity
    """
    if weights is None:
        weights = ensemble_config.get("traditional_weights", {})
    
    skill_weight = weights.get("skill_weight", 0.65)
    location_weight = weights.get("location_weight", 0.20)
    cgpa_weight = weights.get("cgpa_weight", 0.15)
    
    sem = jaccard(student_skills or "", required_skills or "")
    loc = 1.0 if (student_location and job_location and 
                  student_location.lower() == job_location.lower()) else 0.0
    cg = norm(student_cgpa, 6.0, 9.5) if job_min_cgpa > 0 else 0.0
    
    score = skill_weight * sem + location_weight * loc + cgpa_weight * cg
    
    component_scores = {
        "skill_score": round(sem, 4),
        "location_score": round(loc, 4),
        "cgpa_score": round(cg, 4),
        "weights": {
            "skill": skill_weight, 
            "location": location_weight, 
            "cgpa": cgpa_weight
        }
    }
    
    return score, component_scores

# ---------- Ensemble Scoring ----------
def ensemble_score(
    student_skills: str,
    required_skills: str,
    student_location: str,
    job_location: str,
    student_cgpa: float,
    job_min_cgpa: float
) -> Tuple[float, Dict[str, Any]]:
    """
    Calculate ensemble score using both traditional and GloVe methods
    """
    # Get configuration
    ensemble_method = ensemble_config.get("ensemble_method", "weighted")
    method_weights = ensemble_config.get("method_weights", {"traditional": 0.4, "glove": 0.6})
    use_comprehensive = ensemble_config.get("use_comprehensive_glove", True)
    traditional_weights = ensemble_config.get("traditional_weights", {})
    glove_weights = ensemble_config.get("glove_weights", {})
    
    # Get traditional score
    trad_score, trad_components = traditional_score(
        student_skills, required_skills,
        student_location, job_location,
        student_cgpa, job_min_cgpa,
        traditional_weights
    )
    
    # Get GloVe score
    if use_comprehensive:
        glove_score, glove_components = glove_comprehensive_similarity(
            student_skills, required_skills,
            student_location, job_location,
            student_cgpa, job_min_cgpa,
            glove_weights.get("skill_weight"),
            glove_weights.get("location_weight"),
            glove_weights.get("cgpa_weight")
        )
    else:
        # Simple GloVe skill similarity
        glove_skill_score = glove_similarity(student_skills, required_skills)
        
        # Use traditional method for location and CGPA
        loc = 1.0 if (student_location and job_location and 
                      student_location.lower() == job_location.lower()) else 0.0
        cg = norm(student_cgpa, 6.0, 9.5) if job_min_cgpa > 0 else 0.0
        
        skill_weight = glove_weights.get("skill_weight", 0.65)
        location_weight = glove_weights.get("location_weight", 0.20)
        cgpa_weight = glove_weights.get("cgpa_weight", 0.15)
        
        glove_score = skill_weight * glove_skill_score + location_weight * loc + cgpa_weight * cg
        glove_components = {
            "skill_score": round(glove_skill_score, 4),
            "location_score": round(loc, 4),
            "cgpa_score": round(cg, 4),
            "weights": {
                "skill": skill_weight, 
                "location": location_weight, 
                "cgpa": cgpa_weight
            }
        }
    
    # Calculate ensemble score based on method
    if ensemble_method == "max_score":
        final_score = max(trad_score, glove_score)
        selected_method = "traditional" if trad_score >= glove_score else "glove"
        
    elif ensemble_method == "voting":
        # Each component "votes" for the best method
        skill_winner = "traditional" if trad_components["skill_score"] >= glove_components["skill_score"] else "glove"
        location_winner = "traditional" if trad_components["location_score"] >= glove_components["location_score"] else "glove"
        cgpa_winner = "traditional" if trad_components["cgpa_score"] >= glove_components["cgpa_score"] else "glove"
        
        # Calculate component scores using the winning method for each
        skill_score = trad_components["skill_score"] if skill_winner == "traditional" else glove_components["skill_score"]
        location_score = trad_components["location_score"] if location_winner == "traditional" else glove_components["location_score"]
        cgpa_score = trad_components["cgpa_score"] if cgpa_winner == "traditional" else glove_components["cgpa_score"]
        
        # Use the traditional weights for simplicity (could be configurable)
        skill_weight = traditional_weights.get("skill_weight", 0.65)
        location_weight = traditional_weights.get("location_weight", 0.20)
        cgpa_weight = traditional_weights.get("cgpa_weight", 0.15)
        
        final_score = skill_weight * skill_score + location_weight * location_score + cgpa_weight * cgpa_score
        selected_method = "hybrid"
        
    else:  # weighted
        trad_weight = method_weights.get("traditional", 0.4)
        glove_weight = method_weights.get("glove", 0.6)
        final_score = trad_weight * trad_score + glove_weight * glove_score
        selected_method = "weighted"
    
    # Create detailed results for analysis
    ensemble_results = {
        "traditional_score": round(trad_score, 4),
        "glove_score": round(glove_score, 4),
        "traditional_components": trad_components,
        "glove_components": glove_components,
        "ensemble_method": ensemble_method,
        "selected_method": selected_method,
        "method_weights": method_weights,
        "final_score": round(final_score, 4)
    }
    
    return final_score, ensemble_results

# ---------- Validation Function ----------
def validate_match(
    student_skills: str,
    required_skills: str,
    student_location: str,
    job_location: str, 
    score: float,
    components: Dict[str, Any]
) -> bool:
    """
    Validates a match against minimum thresholds to ensure quality
    """
    validation_config = ensemble_config.get("validation", {})
    if not validation_config.get("enabled", True):
        return True
    
    min_skill_match = validation_config.get("min_skill_match", 0.15)
    min_location_match = validation_config.get("min_location_match", 0.0)
    
    # Check if using GloVe components or traditional components
    if "glove_components" in components:
        skill_score = components["glove_components"]["skill_score"]
        location_score = components["glove_components"]["location_score"]
    else:
        skill_score = components["skill_score"]
        location_score = components["location_score"]
    
    # Apply validation rules
    if skill_score < min_skill_match:
        return False
    
    if location_score < min_location_match:
        return False
    
    return True

# ---------- Core Ensemble Allocation ----------
async def run_ensemble_allocation(
    db: AsyncSession,
    scope_emails: Optional[List[str]] = None,
    respect_existing: bool = True,
    skill_weight: Optional[float] = None,
    location_weight: Optional[float] = None,
    cgpa_weight: Optional[float] = None,
    ensemble_method: Optional[str] = None
):
    """
    Run allocation using ensemble of traditional and GloVe methods.
    Returns: run_id
    """
    # Update weights if provided
    if skill_weight is not None:
        ensemble_config.update("traditional_weights.skill_weight", skill_weight)
        ensemble_config.update("glove_weights.skill_weight", skill_weight)
    
    if location_weight is not None:
        ensemble_config.update("traditional_weights.location_weight", location_weight)
        ensemble_config.update("glove_weights.location_weight", location_weight)
    
    if cgpa_weight is not None:
        ensemble_config.update("traditional_weights.cgpa_weight", cgpa_weight)
        ensemble_config.update("glove_weights.cgpa_weight", cgpa_weight)
    
    # Update ensemble method if provided
    if ensemble_method is not None:
        ensemble_config.update("ensemble_method", ensemble_method)

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

    if respect_existing:
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
                    JSON_OBJECT('respect_existing', :re, 'scoped', 1, 'note','empty scope', 'method', 'ensemble'),
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
                    JSON_OBJECT('respect_existing', :re, 'scoped', :sc, 'method', 'ensemble'),
                    JSON_OBJECT('note','no eligible students in scope'))
        """), {"re": 1 if respect_existing else 0, "sc": 1 if bool(scope_emails) else 0})).lastrowid
        await db.commit()
        return int(rid)

    # 6. Filter open jobs
    open_jobs = [jid for jid, info in job_info.items() if info["remaining"] > 0]
    if not open_jobs:
        rid = (await db.execute(text("""
            INSERT INTO alloc_run (status, params_json, metrics_json)
            VALUES ('SUCCESS',
                    JSON_OBJECT('respect_existing', :re, 'scoped', :sc, 'method', 'ensemble'),
                    JSON_OBJECT('note','no open capacity'))
        """), {"re": 1 if respect_existing else 0, "sc": 1 if bool(scope_emails) else 0})).lastrowid
        await db.commit()
        return int(rid)

    # 7. Score student-job pairs with ensemble method
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
            
            # Calculate ensemble score
            score, components = ensemble_score(
                s["skills_text"] or "", 
                j["req_skills_text"],
                s["location_pref"] or "", 
                j["location"] or "",
                float(s["cgpa"] or 0.0), 
                j["min_cgpa"]
            )
            
            # Apply minimum score threshold
            min_threshold = ensemble_config.get("min_score_threshold", 0.2)
            if score < min_threshold:
                continue
            
            # Validate match against quality criteria
            if not validate_match(
                s["skills_text"] or "", 
                j["req_skills_text"],
                s["location_pref"] or "", 
                j["location"] or "",
                score, components
            ):
                continue
            
            pairs.append((score, int(s["student_id"]), int(jid), components))

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
    # Prepare ensemble config for JSON
    config_for_json = {
        'respect_existing': 1 if respect_existing else 0,
        'scoped': 1 if bool(scope_emails) else 0,
        'frozen_count': len(frozen_students),
        'weights': {
            'skill': ensemble_config.get("traditional_weights.skill_weight", 0.65),
            'location': ensemble_config.get("traditional_weights.location_weight", 0.20),
            'cgpa': ensemble_config.get("traditional_weights.cgpa_weight", 0.15)
        },
        'ensemble_method': ensemble_config.get("ensemble_method", "weighted"),
        'method_weights': ensemble_config.get("method_weights", {"traditional": 0.4, "glove": 0.6}),
        'algorithm': 'ensemble_greedy'
    }
    
    params_json = json.dumps(config_for_json)
    
    # Record metrics about the ensemble performance
    metrics = {
        'total_students': len(students),
        'total_jobs': len(open_jobs),
        'matches_found': len(assigned),
        'ensemble_stats': {
            'method': ensemble_config.get("ensemble_method", "weighted"),
            'validation_enabled': ensemble_config.get("validation.enabled", True)
        }
    }
    
    metrics_json = json.dumps(metrics)
    
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
            # Convert components dict to JSON string
            comp_json = json.dumps(comp)
            rows.append({
                "run_id": int(rid),
                "student_id": sid,
                "internship_id": jid,
                "final_score": float(round(score, 4)),
                "component_json": comp_json,
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