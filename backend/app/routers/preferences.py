from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.db import get_db
from datetime import datetime

router = APIRouter(prefix="/preferences", tags=["preferences"])

class PreferenceCreate(BaseModel):
    student_id: int
    internship_id: int
    ranked: Optional[int] = None  # Optional ranking (1, 2, 3, etc.)

@router.post("", status_code=status.HTTP_201_CREATED)
async def add_preference(preference: PreferenceCreate, db: AsyncSession = Depends(get_db)):
    """Add an internship to a student's preferences"""
    try:
        # Check if the preference already exists
        check_result = await db.execute(
            text("""
                SELECT 1 FROM preference 
                WHERE student_id = :student_id AND internship_id = :internship_id
            """),
            {"student_id": preference.student_id, "internship_id": preference.internship_id}
        )
        
        if check_result.scalar_one_or_none():
            # Preference already exists, return success but with a message
            return {
                "success": True,
                "message": "Preference already exists"
            }
        
        # Get the next rank for this student if not provided
        if preference.ranked is None:
            rank_result = await db.execute(
                text("""
                    SELECT COALESCE(MAX(ranked), 0) + 1 FROM preference
                    WHERE student_id = :student_id
                """),
                {"student_id": preference.student_id}
            )
            next_rank = rank_result.scalar_one()
            preference.ranked = next_rank
        
        # Insert the new preference
        await db.execute(
            text("""
                INSERT INTO preference (student_id, internship_id, ranked, created_at)
                VALUES (:student_id, :internship_id, :ranked, :created_at)
            """),
            {
                "student_id": preference.student_id,
                "internship_id": preference.internship_id,
                "ranked": preference.ranked,
                "created_at": datetime.now()
            }
        )
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Preference added successfully",
            "ranked": preference.ranked
        }
    except Exception as e:
        await db.rollback()
        print(f"Error adding preference: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add preference: {str(e)}"
        )