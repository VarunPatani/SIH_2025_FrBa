from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..ensemble_allocation import run_ensemble_allocation, ensemble_config

router = APIRouter(prefix="/allocation/ensemble", tags=["allocation"])

class EnsembleConfigUpdate(BaseModel):
    ensemble_method: Optional[str] = Field(None, description="Ensemble method: 'weighted', 'max_score', or 'voting'")
    method_weights: Optional[Dict[str, float]] = Field(None, description="Weights for each allocation method")
    min_score_threshold: Optional[float] = Field(None, description="Minimum score threshold")
    skill_weight: Optional[float] = Field(None, description="Weight for skill matching")
    location_weight: Optional[float] = Field(None, description="Weight for location matching")
    cgpa_weight: Optional[float] = Field(None, description="Weight for CGPA matching")

class EnsembleAllocationRequest(BaseModel):
    emails: Optional[List[str]] = Field(None, description="Limit allocation to these students (optional)")
    respect_existing: bool = Field(True, description="Respect existing allocations")
    skill_weight: Optional[float] = Field(None, description="Weight for skill matching")
    location_weight: Optional[float] = Field(None, description="Weight for location matching")
    cgpa_weight: Optional[float] = Field(None, description="Weight for CGPA matching")
    ensemble_method: Optional[str] = Field(None, description="Ensemble method to use")

class EnsembleAllocationResponse(BaseModel):
    run_id: int
    message: str

@router.post("/run", response_model=EnsembleAllocationResponse)
async def run_allocation(
    request: EnsembleAllocationRequest,
    db: AsyncSession = Depends(get_db)
):
    try:
        run_id = await run_ensemble_allocation(
            db=db,
            scope_emails=request.emails,
            respect_existing=request.respect_existing,
            skill_weight=request.skill_weight,
            location_weight=request.location_weight,
            cgpa_weight=request.cgpa_weight,
            ensemble_method=request.ensemble_method
        )
        return {
            "run_id": run_id,
            "message": "Ensemble allocation completed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Allocation failed: {str(e)}")

@router.get("/config")
async def get_ensemble_config():
    """Get current ensemble configuration"""
    return ensemble_config.config

@router.post("/config")
async def update_ensemble_config(config_update: EnsembleConfigUpdate):
    """Update ensemble configuration parameters"""
    if config_update.ensemble_method:
        ensemble_config.update("ensemble_method", config_update.ensemble_method)
    
    if config_update.method_weights:
        ensemble_config.update("method_weights", config_update.method_weights)
    
    if config_update.min_score_threshold is not None:
        ensemble_config.update("min_score_threshold", config_update.min_score_threshold)
    
    if config_update.skill_weight is not None:
        ensemble_config.update("traditional_weights.skill_weight", config_update.skill_weight)
        ensemble_config.update("glove_weights.skill_weight", config_update.skill_weight)
    
    if config_update.location_weight is not None:
        ensemble_config.update("traditional_weights.location_weight", config_update.location_weight)
        ensemble_config.update("glove_weights.location_weight", config_update.location_weight)
    
    if config_update.cgpa_weight is not None:
        ensemble_config.update("traditional_weights.cgpa_weight", config_update.cgpa_weight)
        ensemble_config.update("glove_weights.cgpa_weight", config_update.cgpa_weight)
    
    return {"message": "Configuration updated", "config": ensemble_config.config}