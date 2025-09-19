from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db import get_db
from typing import List, Dict, Any

router = APIRouter(prefix="/companies", tags=["companies"])

@router.get("/{company_id}")
async def get_company_info(company_id: int, db: AsyncSession = Depends(get_db)):
    """Get company information"""
    query = text("""
        SELECT org_id, org_name, org_email, org_website, created_at
        FROM organization
        WHERE org_id = :company_id
    """)
    
    result = await db.execute(query, {"company_id": company_id})
    company = result.mappings().first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    return dict(company)

@router.get("/{company_id}/internships")
async def get_company_internships(company_id: int, db: AsyncSession = Depends(get_db)):
    """Get all internships posted by a company"""
    # Query to get internships with applicant and match counts
    query = text("""
        SELECT 
            i.internship_id, 
            i.title, 
            i.description, 
            i.capacity, 
            i.location,
            i.is_active,
            i.created_at,
            i.updated_at,
            (
                SELECT COUNT(DISTINCT p.student_id)
                FROM preference p
                WHERE p.internship_id = i.internship_id
            ) as applicant_count,
            (
                SELECT COUNT(DISTINCT m.student_id)
                FROM match_result m
                WHERE m.internship_id = i.internship_id
            ) as match_count
        FROM 
            internship i
        WHERE 
            i.org_id = :company_id
        ORDER BY 
            i.created_at DESC
    """)
    
    result = await db.execute(query, {"company_id": company_id})
    internships = [dict(row) for row in result.mappings().all()]
    
    return internships

@router.get("/{company_id}/dashboard-stats")
async def get_company_dashboard_stats(company_id: int, db: AsyncSession = Depends(get_db)):
    """Get dashboard statistics for a company"""
    # Query for active internships count
    active_query = text("""
        SELECT COUNT(*) as active_count
        FROM internship
        WHERE org_id = :company_id AND is_active = true
    """)
    
    # Query for total applicants count
    applicants_query = text("""
        SELECT COUNT(DISTINCT p.student_id) as applicant_count
        FROM preference p
        JOIN internship i ON p.internship_id = i.internship_id
        WHERE i.org_id = :company_id
    """)
    
    # Query for average match score
    match_score_query = text("""
        SELECT COALESCE(AVG(m.final_score), 0) as avg_score
        FROM match_result m
        JOIN internship i ON m.internship_id = i.internship_id
        WHERE i.org_id = :company_id
    """)
    
    active_result = await db.execute(active_query, {"company_id": company_id})
    applicants_result = await db.execute(applicants_query, {"company_id": company_id})
    match_score_result = await db.execute(match_score_query, {"company_id": company_id})
    
    active_count = active_result.scalar() or 0
    applicant_count = applicants_result.scalar() or 0
    avg_score = match_score_result.scalar() or 0
    
    # Format average score to 1 decimal place
    avg_score = round(avg_score * 10, 1)
    
    return {
        "activeInternships": active_count,
        "totalApplicants": applicant_count,
        "avgMatchScore": avg_score
    }