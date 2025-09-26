from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db import get_db
from typing import List, Dict, Any
from pydantic import BaseModel

class ShortlistRequest(BaseModel):
    student_id: int


class StatusUpdateRequest(BaseModel):
    is_active: bool

router = APIRouter(prefix="/internships", tags=["internships"])

# Example backend endpoint (this would be in your FastAPI app)
@router.post("/create_internship", status_code=status.HTTP_201_CREATED)
async def create_internship(
    internship: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create a new internship"""
    query = text("""
        INSERT INTO internship (
            org_id, org_name ,title, description, req_skills_text, min_cgpa, 
            location, pincode, capacity, job_role_code, nsqf_required_level,
            min_age, genders_allowed, languages_required_json, is_shift_night,
            wage_min, wage_max, category_quota_json, is_active
        )
        VALUES (
            :org_id, :org_name, :title, :description, :req_skills_text, :min_cgpa,
            :location, :pincode, :capacity, :job_role_code, :nsqf_required_level,
            :min_age, :genders_allowed, :languages_required_json, :is_shift_night,
            :wage_min, :wage_max, :category_quota_json, :is_active
        )
        RETURNING internship_id
    """)
    
    try:
        result = await db.execute(query, {
            "org_id": internship["org_id"],
            "org_name": internship["org_name"],
            "title": internship["title"],
            "description": internship["description"],
            "req_skills_text": internship["req_skills_text"],
            "min_cgpa": internship["min_cgpa"],
            "location": internship["location"],
            "pincode": internship["pincode"],
            "capacity": internship["capacity"],
            "job_role_code": internship["job_role_code"],
            "nsqf_required_level": internship["nsqf_required_level"],
            "min_age": internship["min_age"],
            "genders_allowed": internship["genders_allowed"],
            "languages_required_json": internship["languages_required_json"],
            "is_shift_night": internship["is_shift_night"],
            "wage_min": internship["wage_min"],
            "wage_max": internship["wage_max"],
            "category_quota_json": internship["category_quota_json"],
            "is_active": internship["is_active"]
        })
        
        internship_id = result.scalar_one()
        await db.commit()
        
        return {"internship_id": internship_id, "message": "Internship created successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create internship: {str(e)}"
        )

@router.get("/{internship_id}")
async def get_internship(internship_id: int, db: AsyncSession = Depends(get_db)):
    """Get internship details by ID"""
    query = text("""
        SELECT 
            i.*,
            o.org_name
        FROM 
            internship i
        JOIN 
            organization o ON i.org_id = o.org_id
        WHERE 
            i.internship_id = :internship_id
    """)
    
    result = await db.execute(query, {"internship_id": internship_id})
    internship = result.mappings().first()
    
    if not internship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Internship not found"
        )
    
    return dict(internship)

@router.get("/{internship_id}/candidates")
async def get_internship_candidates(internship_id: int, db: AsyncSession = Depends(get_db)):
    """Get all candidates matched to an internship with their details and match scores"""
    query = text("""
        SELECT 
            s.student_id,
            s.name,
            s.email,
            s.degree,
            s.grad_year,
            s.cgpa,
            s.location_pref as location,
            s.skills_text,
            m.final_score,
            p.created_at as preference_date,
            (
                SELECT 
                    array_agg(sr.name)
                FROM 
                    student_skill ss
                JOIN 
                    skill_ref sr ON ss.skill_code = sr.skill_code
                WHERE 
                    ss.student_id = s.student_id
            ) as structured_skills
        FROM 
            match_result m
        JOIN 
            student s ON m.student_id = s.student_id
        LEFT JOIN 
            preference p ON p.student_id = s.student_id AND p.internship_id = m.internship_id
        WHERE 
            m.internship_id = :internship_id
        ORDER BY 
            m.final_score DESC
    """)
    
    result = await db.execute(query, {"internship_id": internship_id})
    candidates = [dict(row) for row in result.mappings().all()]
    
    return candidates


# Add this endpoint to your existing internships_company.py file


@router.post("/{internship_id}/shortlist", status_code=status.HTTP_200_OK)
async def shortlist_candidate(
    internship_id: int, 
    request: ShortlistRequest,
    db: AsyncSession = Depends(get_db)
):
    """Shortlist a candidate for an internship"""
    
    # Verify that the internship exists
    internship_query = text("""
        SELECT internship_id FROM internship WHERE internship_id = :internship_id
    """)
    
    result = await db.execute(internship_query, {"internship_id": internship_id})
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Internship not found"
        )
    
    # Verify that the student exists
    student_query = text("""
        SELECT student_id FROM student WHERE student_id = :student_id
    """)
    
    result = await db.execute(student_query, {"student_id": request.student_id})
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
        
    # Check if the student is already shortlisted
    shortlist_check_query = text("""
        SELECT 1 FROM shortlisted_candidates
        WHERE internship_id = :internship_id AND student_id = :student_id
    """)
    
    result = await db.execute(
        shortlist_check_query, 
        {"internship_id": internship_id, "student_id": request.student_id}
    )
    
    if result.scalar_one_or_none():
        # Already shortlisted, return success without making changes
        return {"message": "Candidate was already shortlisted"}
    
    # Add to shortlisted candidates table
    shortlist_query = text("""
        INSERT INTO shortlisted_candidates (internship_id, student_id)
        VALUES (:internship_id, :student_id)
    """)
    
    try:
        await db.execute(
            shortlist_query, 
            {"internship_id": internship_id, "student_id": request.student_id}
        )
        await db.commit()
        return {"message": "Candidate has been shortlisted successfully"}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to shortlist candidate: {str(e)}"
        )
    



@router.patch("/{internship_id}/status", status_code=status.HTTP_200_OK)
async def update_internship_status(
    internship_id: int,
    status_update: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update internship active status"""
    query = text("""
        UPDATE internship
        SET is_active = :is_active
        WHERE internship_id = :internship_id
        RETURNING internship_id, title, is_active
    """)
    
    try:
        result = await db.execute(
            query, 
            {"internship_id": internship_id, "is_active": status_update.is_active}
        )
        await db.commit()
        
        internship = result.mappings().first()
        if not internship:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Internship not found"
            )
        
        return dict(internship)
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update internship status: {str(e)}"
        )