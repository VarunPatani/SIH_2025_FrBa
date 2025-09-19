from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
from app.db import get_db

router = APIRouter(prefix="/search", tags=["search"])

# Response models
class InternshipResult(BaseModel):
    internship_id: int
    title: str
    org_name: str
    description: Optional[str] = None
    location: Optional[str] = None
    min_cgpa: Optional[float] = None
    wage_min: Optional[int] = None
    wage_max: Optional[int] = None
    capacity: int = 1
    is_shift_night: bool = False
    required_skills: List[str] = []
    match_score: Optional[float] = None

@router.get("/matches/{student_id}", response_model=List[InternshipResult])
async def get_matched_internships(
    student_id: int, 
    location: Optional[str] = None,
    company: Optional[str] = None,
    skill: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get internships that have match scores for a student"""
    try:
        query = """
            SELECT 
                i.internship_id,
                i.title,
                i.org_name,
                i.description,
                i.location,
                i.min_cgpa,
                i.wage_min,
                i.wage_max,
                i.capacity,
                i.is_shift_night,
                i.req_skills_text,
                mr.final_score * 10 as match_score
            FROM match_result mr
            JOIN internship i ON i.internship_id = mr.internship_id
            WHERE mr.student_id = :student_id
        """
        
        # Add filters
        params = {"student_id": student_id}
        
        if location:
            query += " AND i.location LIKE :location"
            params["location"] = f"%{location}%"
            
        if company:
            query += " AND i.org_name LIKE :company"
            params["company"] = f"%{company}%"
            
        if search:
            query += " AND (i.title LIKE :search OR i.org_name LIKE :search OR i.description LIKE :search)"
            params["search"] = f"%{search}%"
            
        if skill:
            query += " AND i.req_skills_text LIKE :skill"
            params["skill"] = f"%{skill}%"
            
        query += " ORDER BY mr.final_score DESC"
        
        result = await db.execute(text(query), params)
        matches = result.mappings().all()
        
        if not matches:
            return []
            
        return [
            {
                "internship_id": match["internship_id"],
                "title": match["title"],
                "org_name": match["org_name"],
                "description": match["description"],
                "location": match["location"],
                "min_cgpa": float(match["min_cgpa"]) if match["min_cgpa"] else None,
                "wage_min": match["wage_min"],
                "wage_max": match["wage_max"],
                "capacity": match["capacity"],
                "is_shift_night": match["is_shift_night"],
                # Parse skills from the text field - split by commas and trim whitespace
                "required_skills": [s.strip() for s in match["req_skills_text"].split(",")] 
                                  if match["req_skills_text"] else [],
                "match_score": match["match_score"]
            } for match in matches
        ]
    except Exception as e:
        print(f"Error getting matched internships: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get matched internships: {str(e)}"
        )

@router.get("/non-matches/{student_id}", response_model=List[InternshipResult])
async def get_non_matched_internships(
    student_id: int, 
    location: Optional[str] = None,
    company: Optional[str] = None,
    skill: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get internships that don't have match scores for a student"""
    try:
        query = """
            SELECT 
                i.internship_id,
                i.title,
                i.org_name,
                i.description,
                i.location,
                i.min_cgpa,
                i.wage_min,
                i.wage_max,
                i.capacity,
                i.is_shift_night,
                i.req_skills_text
            FROM internship i
            WHERE i.internship_id NOT IN (
                SELECT mr.internship_id 
                FROM match_result mr 
                WHERE mr.student_id = :student_id
            )
            AND i.is_active = true
        """
        
        # Add filters
        params = {"student_id": student_id}
        
        if location:
            query += " AND i.location LIKE :location"
            params["location"] = f"%{location}%"
            
        if company:
            query += " AND i.org_name LIKE :company"
            params["company"] = f"%{company}%"
            
        if search:
            query += " AND (i.title LIKE :search OR i.org_name LIKE :search OR i.description LIKE :search)"
            params["search"] = f"%{search}%"
            
        if skill:
            query += " AND i.req_skills_text LIKE :skill"
            params["skill"] = f"%{skill}%"
            
        query += " ORDER BY i.created_at DESC"
        
        result = await db.execute(text(query), params)
        non_matches = result.mappings().all()
        
        if not non_matches:
            return []
            
        return [
            {
                "internship_id": item["internship_id"],
                "title": item["title"],
                "org_name": item["org_name"],
                "description": item["description"],
                "location": item["location"],
                "min_cgpa": float(item["min_cgpa"]) if item["min_cgpa"] else None,
                "wage_min": item["wage_min"],
                "wage_max": item["wage_max"],
                "capacity": item["capacity"],
                "is_shift_night": item["is_shift_night"],
                # Parse skills from the text field
                "required_skills": [s.strip() for s in item["req_skills_text"].split(",")]
                                  if item["req_skills_text"] else [],
                "match_score": None  # No match score for non-matches
            } for item in non_matches
        ]
    except Exception as e:
        print(f"Error getting non-matched internships: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get non-matched internships: {str(e)}"
        )

@router.get("/filters", response_model=dict)
async def get_filter_options(db: AsyncSession = Depends(get_db)):
    """Get all filter options for internship search"""
    try:
        # Get unique locations
        location_result = await db.execute(text("""
            SELECT DISTINCT location FROM internship 
            WHERE location IS NOT NULL AND location <> ''
        """))
        locations = [row[0] for row in location_result]
        
        # Get unique companies
        company_result = await db.execute(text("""
            SELECT DISTINCT org_name FROM internship 
            WHERE org_name IS NOT NULL AND org_name <> ''
        """))
        companies = [row[0] for row in company_result]
        
        # Extract skills from req_skills_text
        skill_result = await db.execute(text("""
            SELECT DISTINCT regexp_split_to_table(req_skills_text, ',') AS skill
            FROM internship
            WHERE req_skills_text IS NOT NULL AND req_skills_text <> ''
        """))
        
        # Process and clean up skills
        skills_raw = [row[0] for row in skill_result]
        skills = []
        for skill in skills_raw:
            skill = skill.strip()
            if skill and skill not in skills:
                skills.append(skill)
        
        skills.sort()  # Sort alphabetically
        
        return {
            "locations": locations,
            "companies": companies,
            "skills": skills
        }
    except Exception as e:
        print(f"Error getting filter options: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get filter options: {str(e)}"
        )