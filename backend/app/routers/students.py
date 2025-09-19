from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List, Union, Any
from decimal import Decimal
from app.db import get_db
from datetime import datetime
import json

router = APIRouter(prefix="/students", tags=["students"])

class StudentProfile(BaseModel):
    student_id: int
    name: str
    email: str
    phone: Optional[str] = None
    highest_qualification: Optional[str] = None
    ext_id: Optional[str] = None
    degree: Optional[str] = None
    # Update types to match what DB returns
    cgpa: Optional[Union[str, Decimal, float]] = None
    grad_year: Optional[int] = None
    tenth_percent: Optional[Union[str, Decimal, float]] = None
    twelfth_percent: Optional[Union[str, Decimal, float]] = None
    location_pref: Optional[str] = None
    pincode: Optional[str] = None
    willing_radius_km: Optional[int] = None
    category_code: Optional[str] = None
    disability_code: Optional[str] = None
    # This could be a string or a parsed list/dict
    languages_json: Optional[Any] = None
    skills_text: Optional[str] = None
    resume_url: Optional[str] = None
    resume_summary: Optional[str] = None

@router.get("/{student_id}", response_model=StudentProfile)
async def get_student_profile(student_id: int, db: AsyncSession = Depends(get_db)):
    """Get a student's full profile information"""
    try:
        result = await db.execute(
            text("""
                SELECT 
                    student_id, name, email, phone, highest_qualification, 
                    ext_id, degree, cgpa, grad_year, tenth_percent,
                    twelfth_percent, location_pref, pincode, willing_radius_km,
                    category_code, disability_code, languages_json, skills_text,
                    resume_url, resume_summary,
                    COALESCE(
                        (SELECT array_agg(internship_id) 
                        FROM shortlisted_candidates 
                        WHERE student_id = s.student_id
                    ), '{}'::int[]) as shortlisted_for
                FROM student s
                WHERE student_id = :student_id
            """),
            {"student_id": student_id}
        )
        
        student = result.mappings().first()
        
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student with id {student_id} not found"
            )
            
        # Handle languages_json: ensure it's a string for the response
        languages = student["languages_json"]
        if languages and not isinstance(languages, str):
            try:
                # If it's already parsed as a list or dict, convert to JSON string
                languages = json.dumps(languages)
            except:
                # Fallback
                languages = str(languages)
        
        # Create a copy of student data to modify
        student_data = dict(student)
        student_data["languages_json"] = languages
        
        # Convert decimal values to strings if necessary
        for field in ["cgpa", "tenth_percent", "twelfth_percent"]:
            if student_data[field] and isinstance(student_data[field], Decimal):
                student_data[field] = str(student_data[field])
        
        # Convert willing_radius_km to string if it's an int
        if student_data["willing_radius_km"] and isinstance(student_data["willing_radius_km"], int):
            student_data["willing_radius_km"] = str(student_data["willing_radius_km"])
            
        return student_data
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting student profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get student profile: {str(e)}"
        )

@router.put("/update", response_model=dict)
async def update_student_profile(profile: StudentProfile, db: AsyncSession = Depends(get_db)):
    """Update a student's profile information"""
    try:
        # Check if student exists
        check_result = await db.execute(
            text("SELECT 1 FROM student WHERE student_id = :student_id"),
            {"student_id": profile.student_id}
        )
        
        if not check_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Student with id {profile.student_id} not found"
            )
            
        # Convert willing_radius_km to integer if needed
        willing_radius_km = profile.willing_radius_km
        if willing_radius_km is not None and isinstance(willing_radius_km, str):
            try:
                willing_radius_km = int(willing_radius_km)
            except ValueError:
                willing_radius_km = 20  # Default value if conversion fails
        
        # Process languages_json for database storage
        languages_json = profile.languages_json
        
        # Convert languages to JSON string if it's not already
        if languages_json is not None:
            if isinstance(languages_json, (list, dict)):
                # Convert Python object to JSON string
                languages_json = json.dumps(languages_json)
            elif isinstance(languages_json, str):
                # Ensure the string is valid JSON by parsing and re-encoding it
                try:
                    parsed = json.loads(languages_json)
                    languages_json = json.dumps(parsed)
                except json.JSONDecodeError:
                    # If the string isn't valid JSON, wrap it as a JSON string array
                    languages_json = json.dumps([languages_json])
                
        # Update the student record
        await db.execute(
            text("""
                UPDATE student
                SET 
                    name = :name,
                    email = :email,
                    phone = :phone,
                    highest_qualification = :highest_qualification,
                    ext_id = :ext_id,
                    degree = :degree,
                    cgpa = :cgpa,
                    grad_year = :grad_year,
                    tenth_percent = :tenth_percent,
                    twelfth_percent = :twelfth_percent,
                    location_pref = :location_pref,
                    pincode = :pincode,
                    willing_radius_km = :willing_radius_km,
                    category_code = :category_code,
                    disability_code = :disability_code,
                    languages_json = :languages_json,
                    skills_text = :skills_text,
                    resume_url = :resume_url,
                    resume_summary = :resume_summary,
                    updated_at = :updated_at
                WHERE student_id = :student_id
            """),
            {
                "student_id": profile.student_id,
                "name": profile.name,
                "email": profile.email,
                "phone": profile.phone,
                "highest_qualification": profile.highest_qualification,
                "ext_id": profile.ext_id,
                "degree": profile.degree,
                "cgpa": profile.cgpa,
                "grad_year": profile.grad_year,
                "tenth_percent": profile.tenth_percent,
                "twelfth_percent": profile.twelfth_percent,
                "location_pref": profile.location_pref,
                "pincode": profile.pincode,
                "willing_radius_km": willing_radius_km,
                "category_code": profile.category_code,
                "disability_code": profile.disability_code,
                "languages_json": languages_json,  # Now properly formatted as a JSON string
                "skills_text": profile.skills_text,
                "resume_url": profile.resume_url,
                "resume_summary": profile.resume_summary,
                "updated_at": datetime.now()
            }
        )
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Profile updated successfully"
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error updating student profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update student profile: {str(e)}"
        )