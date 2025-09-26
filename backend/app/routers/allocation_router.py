from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db import get_db
from app.allocation import run_allocation
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

router = APIRouter(prefix="/allocation", tags=["allocation"])

class AllocationConfig(BaseModel):
    skill_weight: float = 0.65
    location_weight: float = 0.20
    cgpa_weight: float = 0.15
    respect_existing: bool = True
    scope_emails: Optional[List[str]] = None

# Fix the allocation_config insertion:
@router.post("/run", status_code=status.HTTP_200_OK)
async def trigger_allocation(
    config: AllocationConfig = AllocationConfig(),
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger a new allocation run with optional configuration parameters
    """
    try:
        # Update allocation weights in database if needed
        # Check if the allocation_config table exists
        check_table = await db.execute(text("""
            SELECT to_regclass('allocation_config') IS NOT NULL as exists
        """))
        table_exists = check_table.scalar_one()
        
        if table_exists:
            await db.execute(text("""
                INSERT INTO allocation_config (skill_weight, location_weight, cgpa_weight, updated_at)
                VALUES (:sw, :lw, :cw, NOW())
            """), {
                "sw": config.skill_weight,
                "lw": config.location_weight,
                "cw": config.cgpa_weight
            })
            await db.commit()
        
        # Run allocation with the given parameters
        run_id = await run_allocation(
            db=db, 
            respect_existing=config.respect_existing,
            scope_emails=config.scope_emails,
            skill_weight=config.skill_weight,
            location_weight=config.location_weight,
            cgpa_weight=config.cgpa_weight
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
            "success": True,
            "run_id": run_id,
            "match_count": stats["match_count"] if stats else 0,
            "students_matched": stats["students_matched"] if stats else 0,
            "internships_matched": stats["internships_matched"] if stats else 0,
            "message": "Allocation run completed successfully"
        }
        
    except Exception as e:
        # Add more detailed error logging
        import traceback
        error_details = traceback.format_exc()
        print(f"Allocation error: {str(e)}")
        print(error_details)
        
        await db.rollback()  # Ensure transaction is rolled back
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Allocation failed: {str(e)}"
        )

@router.get("/runs/latest")
async def get_latest_run(db: AsyncSession = Depends(get_db)):
    """Get information about the latest allocation run"""
    query = text("""
        SELECT 
            ar.run_id, ar.status, ar.created_at,
            (SELECT COUNT(*) FROM match_result WHERE run_id = ar.run_id) as match_count,
            (SELECT COUNT(DISTINCT student_id) FROM match_result WHERE run_id = ar.run_id) as students_matched,
            (SELECT COUNT(DISTINCT internship_id) FROM match_result WHERE run_id = ar.run_id) as internships_matched
        FROM alloc_run ar
        ORDER BY ar.created_at DESC
        LIMIT 1
    """)
    
    result = await db.execute(query)
    run = result.mappings().first()
    
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No allocation runs found"
        )
    
    return dict(run)

@router.get("/runs/{run_id}/results")
async def get_run_results(run_id: int, db: AsyncSession = Depends(get_db)):
    """Get the results of a specific allocation run"""
    # First check if run exists
    run_query = text("""
        SELECT run_id, status, created_at, params_json
        FROM alloc_run
        WHERE run_id = :run_id
    """)
    
    result = await db.execute(run_query, {"run_id": run_id})
    run_data = result.mappings().first()
    
    if not run_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Allocation run not found"
        )
    
    # Process the run data to extract weight information
    run = dict(run_data)
    
    # Parse the params_json if it exists
    params = {}
    if run.get('params_json'):
        if isinstance(run['params_json'], str):
            try:
                import json
                params = json.loads(run['params_json'])
            except:
                params = {}
        else:
            params = run['params_json']
    
    # Extract weight values
    weights = params.get('weights', {})
    run['skill_weight'] = weights.get('skill', 0.65)
    run['location_weight'] = weights.get('location', 0.20)
    run['cgpa_weight'] = weights.get('cgpa', 0.15)
    run['algorithm'] = params.get('algorithm', 'greedy')
    run['respect_existing'] = params.get('respect_existing', True)
    
    # Rest of the function remains the same...
    # Get match results
    matches_query = text("""
        SELECT 
            mr.match_id,
            mr.student_id,
            s.name as student_name,
            s.email as student_email,
            s.cgpa as student_cgpa,
            mr.internship_id,
            i.title as internship_title,
            i.location,
            o.org_name as company_name,
            mr.final_score as score,
            mr.component_json
        FROM match_result mr
        JOIN student s ON mr.student_id = s.student_id
        JOIN internship i ON mr.internship_id = i.internship_id
        JOIN organization o ON i.org_id = o.org_id
        WHERE mr.run_id = :run_id
        ORDER BY mr.final_score DESC
    """)
    
    result = await db.execute(matches_query, {"run_id": run_id})
    matches = [dict(row) for row in result.mappings().all()]
    
    # Get stats
    stats_query = text("""
        SELECT 
            COUNT(*) as match_count,
            COUNT(DISTINCT student_id) as students_matched,
            COUNT(DISTINCT internship_id) as internships_matched,
            AVG(final_score) as avg_score
        FROM match_result
        WHERE run_id = :run_id
    """)

    result = await db.execute(stats_query, {"run_id": run_id})
    stats = dict(result.mappings().first())
    
    return {
        "run": run,
        "stats": stats,
        "matches": matches
    }

# Add this endpoint to the allocation router

@router.get("/unmatched")
async def get_unmatched_stats(db: AsyncSession = Depends(get_db)):
    """Get stats on unmatched students and internships"""
    
    # Get unmatched students
    unmatched_students_query = text("""
        SELECT COUNT(*) as count
        FROM student s
        LEFT JOIN match_result mr ON s.student_id = mr.student_id
        WHERE mr.student_id IS NULL
    """)
    
    # Get internships with available capacity
    open_internships_query = text("""
        SELECT 
            COUNT(*) as count,
            SUM(i.capacity - COALESCE(matched.count, 0)) as open_slots
        FROM 
            internship i
        LEFT JOIN (
            SELECT 
                internship_id, 
                COUNT(*) as count
            FROM 
                match_result
            GROUP BY 
                internship_id
        ) matched ON i.internship_id = matched.internship_id
        WHERE 
            i.is_active = true AND
            (i.capacity > COALESCE(matched.count, 0))
    """)
    
    result_students = await db.execute(unmatched_students_query)
    result_internships = await db.execute(open_internships_query)
    
    unmatched_students = result_students.mappings().first()["count"]
    open_internships = result_internships.mappings().first()
    
    return {
        "unmatched_students": unmatched_students,
        "open_internships": open_internships["count"],
        "total_open_slots": open_internships["open_slots"]
    }



# Add this endpoint to fetch all runs

@router.get("/runs", status_code=status.HTTP_200_OK)
async def get_allocation_runs(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all allocation runs with optional pagination
    """
    try:
        query = text("""
            SELECT
                ar.run_id, 
                ar.status,
                ar.params_json,
                ar.metrics_json,
                ar.error_message,
                ar.created_at,
                (SELECT COUNT(*) FROM match_result WHERE run_id = ar.run_id) as match_count,
                (SELECT COUNT(DISTINCT student_id) FROM match_result WHERE run_id = ar.run_id) as students_matched,
                (SELECT COUNT(DISTINCT internship_id) FROM match_result WHERE run_id = ar.run_id) as internships_matched
            FROM
                alloc_run ar
            ORDER BY
                ar.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        
        result = await db.execute(query, {"limit": limit, "offset": offset})
        runs = []
        
        # Process each run to ensure valid JSON
        for row in result.mappings().all():
            run_dict = dict(row)
            
            # Ensure params_json and metrics_json are properly formatted
            if run_dict['params_json'] is not None:
                if isinstance(run_dict['params_json'], str):
                    try:
                        # If it's already a string, parse it first to validate
                        import json
                        run_dict['params_json'] = json.loads(run_dict['params_json'])
                    except:
                        run_dict['params_json'] = {}
            else:
                run_dict['params_json'] = {}
                
            if run_dict['metrics_json'] is not None:
                if isinstance(run_dict['metrics_json'], str):
                    try:
                        import json
                        run_dict['metrics_json'] = json.loads(run_dict['metrics_json'])
                    except:
                        run_dict['metrics_json'] = {}
            else:
                run_dict['metrics_json'] = {}
            
            runs.append(run_dict)
        
        # Get total count for pagination
        count_query = text("SELECT COUNT(*) FROM alloc_run")
        result = await db.execute(count_query)
        total = result.scalar_one()
        
        return {
            "runs": runs,
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        import traceback
        print(f"Error fetching runs: {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch allocation runs: {str(e)}"
        )