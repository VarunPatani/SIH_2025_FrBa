from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, desc, and_
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
from app.db import get_db

router = APIRouter(prefix="/admin/logs", tags=["admin-logs"])

# Response models
class AuditLogResponse(BaseModel):
    audit_id: int
    run_id: Optional[int] = None
    level: str
    message: str
    payload_json: Optional[dict] = None
    created_at: datetime

class SystemLogResponse(BaseModel):
    log_id: int
    level: str
    message: str
    module: str
    user_id: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

class LogsSummary(BaseModel):
    total_audit_logs: int
    total_system_logs: int
    error_count_today: int
    warning_count_today: int
    info_count_today: int

@router.get("/audit", response_model=List[AuditLogResponse])
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    level: Optional[str] = Query(None, regex="^(INFO|WARN|ERROR)$"),
    run_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs with filtering and pagination"""
    try:
        query = """
            SELECT 
                audit_id, run_id, level, message, payload_json, created_at
            FROM audit_log
            WHERE 1=1
        """
        params = {"limit": limit, "offset": offset}
        
        # Add filters
        if level:
            query += " AND level = :level"
            params["level"] = level
            
        if run_id:
            query += " AND run_id = :run_id"
            params["run_id"] = run_id
            
        if start_date:
            query += " AND created_at >= :start_date"
            params["start_date"] = start_date
            
        if end_date:
            query += " AND created_at <= :end_date"
            params["end_date"] = end_date
            
        if search:
            query += " AND message ILIKE :search"
            params["search"] = f"%{search}%"
            
        query += " ORDER BY created_at DESC, audit_id DESC LIMIT :limit OFFSET :offset"
        
        result = await db.execute(text(query), params)
        logs = result.mappings().all()
        
        return [
            {
                "audit_id": log["audit_id"],
                "run_id": log["run_id"],
                "level": log["level"],
                "message": log["message"],
                "payload_json": log["payload_json"],
                "created_at": log["created_at"]
            } for log in logs
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch audit logs: {str(e)}"
        )

@router.get("/system", response_model=List[SystemLogResponse])
async def get_system_logs(
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    level: Optional[str] = Query(None, regex="^(INFO|WARN|ERROR|DEBUG)$"),
    module: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get system logs with filtering and pagination"""
    try:
        # For now, we'll create a mock system logs table structure
        # In a real implementation, you'd have a system_logs table
        query = """
            SELECT 
                audit_id as log_id,
                level,
                message,
                'system' as module,
                NULL as user_id,
                NULL as ip_address,
                NULL as user_agent,
                created_at
            FROM audit_log
            WHERE 1=1
        """
        params = {"limit": limit, "offset": offset}
        
        # Add filters
        if level:
            query += " AND level = :level"
            params["level"] = level
            
        if module:
            query += " AND 'system' = :module"
            params["module"] = module
            
        if start_date:
            query += " AND created_at >= :start_date"
            params["start_date"] = start_date
            
        if end_date:
            query += " AND created_at <= :end_date"
            params["end_date"] = end_date
            
        if search:
            query += " AND message ILIKE :search"
            params["search"] = f"%{search}%"
            
        query += " ORDER BY created_at DESC, audit_id DESC LIMIT :limit OFFSET :offset"
        
        result = await db.execute(text(query), params)
        logs = result.mappings().all()
        
        return [
            {
                "log_id": log["log_id"],
                "level": log["level"],
                "message": log["message"],
                "module": log["module"],
                "user_id": log["user_id"],
                "ip_address": log["ip_address"],
                "user_agent": log["user_agent"],
                "created_at": log["created_at"]
            } for log in logs
        ]
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch system logs: {str(e)}"
        )

@router.get("/summary", response_model=LogsSummary)
async def get_logs_summary(db: AsyncSession = Depends(get_db)):
    """Get logs summary statistics"""
    try:
        # Get audit logs summary
        audit_query = text("""
            SELECT 
                COUNT(*) as total_audit_logs,
                COUNT(CASE WHEN level = 'ERROR' AND created_at >= CURRENT_DATE THEN 1 END) as error_count_today,
                COUNT(CASE WHEN level = 'WARN' AND created_at >= CURRENT_DATE THEN 1 END) as warning_count_today,
                COUNT(CASE WHEN level = 'INFO' AND created_at >= CURRENT_DATE THEN 1 END) as info_count_today
            FROM audit_log
        """)
        
        audit_result = await db.execute(audit_query)
        audit_stats = audit_result.mappings().first()
        
        # For system logs, we'll use the same table for now
        system_query = text("""
            SELECT COUNT(*) as total_system_logs
            FROM audit_log
        """)
        
        system_result = await db.execute(system_query)
        system_stats = system_result.mappings().first()
        
        return {
            "total_audit_logs": audit_stats["total_audit_logs"],
            "total_system_logs": system_stats["total_system_logs"],
            "error_count_today": audit_stats["error_count_today"],
            "warning_count_today": audit_stats["warning_count_today"],
            "info_count_today": audit_stats["info_count_today"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch logs summary: {str(e)}"
        )

@router.post("/test-logs")
async def add_test_logs(db: AsyncSession = Depends(get_db)):
    """Add test logs with different timestamps for demonstration"""
    try:
        from datetime import datetime, timedelta
        import json
        
        test_logs = [
            {
                "run_id": None,
                "level": "INFO",
                "message": "System startup completed",
                "payload_json": {"version": "1.0.0", "startup_time": "2.3s"},
                "created_at": datetime.now() - timedelta(hours=1)
            },
            {
                "run_id": None,
                "level": "WARN",
                "message": "High memory usage detected",
                "payload_json": {"memory_usage": "85%", "threshold": "80%"},
                "created_at": datetime.now() - timedelta(minutes=30)
            },
            {
                "run_id": None,
                "level": "ERROR",
                "message": "Database connection timeout",
                "payload_json": {"timeout": "30s", "retries": 3},
                "created_at": datetime.now() - timedelta(minutes=15)
            },
            {
                "run_id": None,
                "level": "INFO",
                "message": "User authentication successful",
                "payload_json": {"user_id": 123, "ip": "192.168.1.100"},
                "created_at": datetime.now() - timedelta(minutes=5)
            },
            {
                "run_id": None,
                "level": "INFO",
                "message": "Cache cleared successfully",
                "payload_json": {"cache_size": "50MB", "items_cleared": 150},
                "created_at": datetime.now() - timedelta(minutes=1)
            }
        ]
        
        for log in test_logs:
            await db.execute(text("""
                INSERT INTO audit_log (run_id, level, message, payload_json, created_at)
                VALUES (:run_id, :level, :message, :payload_json, :created_at)
            """), {
                "run_id": log["run_id"],
                "level": log["level"],
                "message": log["message"],
                "payload_json": json.dumps(log["payload_json"]),
                "created_at": log["created_at"]
            })
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Added 5 test logs with different timestamps",
            "logs_added": len(test_logs)
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add test logs: {str(e)}"
        )

@router.get("/export")
async def export_logs(
    log_type: str = Query(..., regex="^(audit|system)$"),
    format: str = Query("json", regex="^(json|csv)$"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    level: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Export logs in JSON or CSV format"""
    try:
        if log_type == "audit":
            query = """
                SELECT 
                    audit_id, run_id, level, message, payload_json, created_at
                FROM audit_log
                WHERE 1=1
            """
        else:
            query = """
                SELECT 
                    audit_id as log_id, level, message, 'system' as module, created_at
                FROM audit_log
                WHERE 1=1
            """
            
        params = {}
        
        # Add date filters
        if start_date:
            query += " AND created_at >= :start_date"
            params["start_date"] = start_date
            
        if end_date:
            query += " AND created_at <= :end_date"
            params["end_date"] = end_date
            
        if level:
            query += " AND level = :level"
            params["level"] = level
            
        query += " ORDER BY created_at DESC"
        
        result = await db.execute(text(query), params)
        logs = result.mappings().all()
        
        if format == "csv":
            # Convert to CSV format
            import csv
            import io
            
            output = io.StringIO()
            if log_type == "audit":
                fieldnames = ["audit_id", "run_id", "level", "message", "payload_json", "created_at"]
            else:
                fieldnames = ["log_id", "level", "message", "module", "created_at"]
                
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            
            for log in logs:
                writer.writerow(dict(log))
                
            return {
                "data": output.getvalue(),
                "content_type": "text/csv",
                "filename": f"{log_type}_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        else:
            return {
                "data": [dict(log) for log in logs],
                "content_type": "application/json",
                "filename": f"{log_type}_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            }
            
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export logs: {str(e)}"
        )
