from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import List, Optional
from app.db import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Response models
class TopMatch(BaseModel):
    internship_id: int
    title: str
    org_name: str
    location: Optional[str]
    description: Optional[str]
    final_score: float

class Preference(BaseModel):
    internship_id: int
    title: str
    org_name: str
    status: str
    date: str

class ProfileCompletion(BaseModel):
    completion_percentage: int
    missing_fields: List[str]

@router.get("/matches/student/{student_id}", response_model=List[TopMatch])
async def get_top_matches(student_id: int, limit: int = 3, db: AsyncSession = Depends(get_db)):
    """Get top matches for a student based on match scores"""
    try:
        # Query top matches
        result = await db.execute(text("""
            SELECT 
                i.internship_id,
                i.title,
                i.org_name,
                i.location,
                i.description,
                mr.final_score
            FROM match_result mr
            JOIN internship i ON mr.internship_id = i.internship_id
            WHERE mr.student_id = :student_id
            ORDER BY mr.final_score DESC
            LIMIT :limit
        """), {"student_id": student_id, "limit": limit})
        
        matches = result.mappings().all()
        
        if not matches:
            # Return empty array if no matches
            return []
            
        return [
            {
                "internship_id": match["internship_id"],
                "title": match["title"],
                "org_name": match["org_name"],
                "location": match["location"],
                "description": match["description"],
                "final_score": match["final_score"] * 10
            } for match in matches
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get matches: {str(e)}"
        )

@router.get("/preferences/student/{student_id}", response_model=List[Preference])
async def get_student_preferences(student_id: int, db: AsyncSession = Depends(get_db)):
    """Get all preferences for a student with internship details"""
    try:
        result = await db.execute(text("""
            SELECT 
                p.internship_id,
                i.title,
                i.org_name,
                -- Placeholder for status since there's no actual status in the schema
                -- We'll use preference rank as a proxy
                CASE 
                    WHEN p.ranked = 1 THEN 'Top Choice'
                    WHEN p.ranked = 2 THEN 'Second Choice'
                    WHEN p.ranked = 3 THEN 'Third Choice'
                    ELSE 'Interested'
                END as status,
                -- Format date as relative
                TO_CHAR(p.created_at, 'DD Mon YYYY') as date_created
            FROM preference p
            JOIN internship i ON i.internship_id = p.internship_id
            WHERE p.student_id = :student_id
            ORDER BY p.ranked ASC
        """), {"student_id": student_id})
        
        preferences = result.mappings().all()
        
        if not preferences:
            return []
            
        return [
            {
                "internship_id": pref["internship_id"],
                "title": pref["title"],
                "org_name": pref["org_name"],
                "status": pref["status"],
                "date": pref["date_created"]
            } for pref in preferences
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get preferences: {str(e)}"
        )

@router.get("/students/{student_id}/completion", response_model=ProfileCompletion)
async def get_profile_completion(student_id: int, db: AsyncSession = Depends(get_db)):
    """Calculate profile completion percentage based on filled fields"""
    try:
        result = await db.execute(text("""
            SELECT 
                name,
                email,
                phone,
                degree,
                cgpa,
                grad_year,
                highest_qualification,
                tenth_percent,
                twelfth_percent,
                location_pref,
                pincode,
                willing_radius_km,
                category_code,
                disability_code,
                languages_json,
                skills_text,
                resume_url,
                resume_summary
            FROM student
            WHERE student_id = :student_id
        """), {"student_id": student_id})
        
        student = result.mappings().first()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student with id {student_id} not found"
            )
            
        # Define fields required for a complete profile
        required_fields = {
            'name': 'Name',
            'email': 'Email',
            'phone': 'Phone Number',
            'highest_qualification': 'Highest Qualification',
            'degree': 'Degree',
            'cgpa': 'CGPA',
            'grad_year': 'Graduation Year',
            'location_pref': 'Preferred Location',
            'skills_text': 'Skills',
            'resume_url': 'Resume',
            'resume_summary': 'Resume Summary'
        }
        
        # Check which fields are missing - improved check for different data types
        missing_fields = []
        completed_fields = 0
        
        for field, display_name in required_fields.items():
            # Handle different data types properly
            value = student[field]
            
            # Check if the field is empty based on its type
            is_empty = (
                value is None or                        # None values
                value == '' or                          # Empty strings
                (isinstance(value, str) and value.strip() == '') or  # Whitespace strings
                (isinstance(value, (int, float)) and value == 0)     # Zero numeric values
            )
            
            if is_empty:
                missing_fields.append(display_name)
            else:
                completed_fields += 1
                
        # Calculate completion percentage
        completion_percentage = int((completed_fields / len(required_fields)) * 100)
        
        # For debugging - print values to the console (you can remove this later)
        # print(f"Student ID: {student_id}, Completion: {completion_percentage}%")
        # print(f"Missing fields: {missing_fields}")
        # print(f"Completed fields: {completed_fields}/{len(required_fields)}")
        
        return {
            "completion_percentage": completion_percentage,
            "missing_fields": missing_fields
        }
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Print the full error for debugging
        import traceback
        print(f"Error calculating profile completion: {str(e)}")
        print(traceback.format_exc())
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate profile completion: {str(e)}"
        )