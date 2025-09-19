from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.db import get_db
import json

router = APIRouter(prefix="/internships_details", tags=["internships_details"])

# Language code to full name mapping
LANGUAGE_MAP = {
    "en": "English",
    "hi": "Hindi",
    "kn": "Kannada",
    "mr": "Marathi",
    "ta": "Tamil",
    "te": "Telugu",
    "bn": "Bengali",
    "gu": "Gujarati",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
    "as": "Assamese",
    "or": "Odia",
    "sa": "Sanskrit",
    "sd": "Sindhi",
    "si": "Sinhala",
    "ne": "Nepali",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ru": "Russian",
    "ar": "Arabic",
    # Add more languages as needed
}

# Response model for internship details
class InternshipDetail(BaseModel):
    internship_id: int
    title: str
    org_name: Optional[str]
    description: Optional[str]
    location: Optional[str]
    min_cgpa: float
    wage_min: Optional[int]
    wage_max: Optional[int]
    capacity: int
    is_shift_night: bool
    required_skills: List[str] = []
    job_role_code: Optional[str]
    nsqf_required_level: Optional[int]
    min_age: Optional[int]
    category_quota_json: Optional[Dict[str, Any]]
    languages_required_json: Optional[Dict[str, Any]]
    match_score: Optional[float]

@router.get("/{internship_id}", response_model=InternshipDetail)
async def get_internship_details(internship_id: int, student_id: Optional[int] = None, db: AsyncSession = Depends(get_db)):
    """Get detailed information about a specific internship"""
    try:
        # Base query for internship details
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
                i.job_role_code,
                i.nsqf_required_level,
                i.min_age,
                i.category_quota_json,
                i.languages_required_json
        """
        
        # If student ID is provided, also get match score
        if student_id:
            query += ", (mr.final_score * 10) as match_score "
            query += "FROM internship i LEFT JOIN match_result mr ON i.internship_id = mr.internship_id AND mr.student_id = :student_id "
        else:
            query += ", NULL as match_score "
            query += "FROM internship i "
            
        query += "WHERE i.internship_id = :internship_id AND i.is_active = true"
        
        result = await db.execute(
            text(query), 
            {"internship_id": internship_id, "student_id": student_id}
        )
        
        internship = result.mappings().first()
        
        if not internship:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Internship with ID {internship_id} not found"
            )
            
        # Parse skills from text field
        required_skills = []
        if internship["req_skills_text"]:
            required_skills = [s.strip() for s in internship["req_skills_text"].split(",") if s.strip()]
            
        # Parse JSON fields
        category_quota = None
        if internship["category_quota_json"]:
            try:
                if isinstance(internship["category_quota_json"], str):
                    category_quota = json.loads(internship["category_quota_json"])
                else:
                    category_quota = internship["category_quota_json"]
            except:
                category_quota = {}
                
        languages_required = None
        if internship["languages_required_json"]:
            try:
                if isinstance(internship["languages_required_json"], str):
                    # Parse JSON string
                    languages_required = json.loads(internship["languages_required_json"])
                else:
                    # Use the value directly
                    languages_required = internship["languages_required_json"]
                
                # Convert language codes to full names
                if isinstance(languages_required, list):
                    # For array format: Convert list of codes to dictionary with full names
                    languages_required = {LANGUAGE_MAP.get(lang, lang): "" for lang in languages_required}
                elif isinstance(languages_required, dict):
                    # For object format: Convert dictionary keys from codes to full names
                    languages_required = {
                        LANGUAGE_MAP.get(lang, lang): value 
                        for lang, value in languages_required.items()
                    }
            except Exception as e:
                print(f"Error parsing languages_required_json: {e}")
                languages_required = {}
            
        return {
            "internship_id": internship["internship_id"],
            "title": internship["title"],
            "org_name": internship["org_name"],
            "description": internship["description"],
            "location": internship["location"],
            "min_cgpa": float(internship["min_cgpa"]) if internship["min_cgpa"] else 0.0,
            "wage_min": internship["wage_min"],
            "wage_max": internship["wage_max"],
            "capacity": internship["capacity"],
            "is_shift_night": internship["is_shift_night"],
            "required_skills": required_skills,
            "job_role_code": internship["job_role_code"],
            "nsqf_required_level": internship["nsqf_required_level"],
            "min_age": internship["min_age"],
            "category_quota_json": category_quota,
            "languages_required_json": languages_required,
            "match_score": internship["match_score"]
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting internship details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get internship details: {str(e)}"
        )