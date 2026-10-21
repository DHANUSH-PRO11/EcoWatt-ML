import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.metadata import ModelMetricsResponse
from backend.app.models.metadata import ModelEvaluationMeta
from ml.config import METRICS_FILE
from backend.app.services.model_health_service import (
    get_model_health_status,
    execute_safe_retraining,
    list_training_records,
)

router = APIRouter(prefix="/api/model", tags=["Model & ML Ops"])


@router.get("/metrics", response_model=ModelMetricsResponse)
def get_model_metrics(db: Session = Depends(get_db)):
    """Retrieve evaluation metrics (MAE, RMSE, R2) for all candidate models and selected production forecaster."""
    if not METRICS_FILE.exists():
        raise HTTPException(status_code=404, detail="Model evaluation metrics file not found. Please train models first.")

    try:
        with open(METRICS_FILE, "r") as f:
            metrics_data = json.load(f)
        return metrics_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read model metrics: {str(e)}")


@router.get("/health")
def get_health_and_drift(db: Session = Depends(get_db)):
    """Evaluate rolling MAE/RMSE, distribution shift, and drift classification (Healthy, Warning, Drift Detected)."""
    try:
        return get_model_health_status(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate model health: {str(e)}")


@router.get("/history")
def get_training_history(limit: int = Query(15, ge=1, le=100), db: Session = Depends(get_db)):
    """Retrieve persistent training logs with candidates, metrics, errors, and promotion decisions."""
    try:
        return list_training_records(db, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve training history: {str(e)}")


@router.post("/train-safe")
def retrain_model_safely(
    force_sample: bool = False,
    initiated_by: str = Query("user_manual", description="User or automated trigger initiating retraining"),
    db: Session = Depends(get_db),
):
    """
    Execute protected model retraining:
    Trains all candidate models, evaluates validation metrics against the previous baseline,
    promotes the new model only if criteria pass, and rolls back gracefully on degradation or failure.
    """
    try:
        result = execute_safe_retraining(db, force_sample=force_sample, initiated_by=initiated_by)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Protected retraining failed: {str(e)}")


@router.post("/train")
def retrain_model_pipeline(
    force_sample: bool = False,
    db: Session = Depends(get_db),
):
    """Trigger retraining of forecasting models with atomic database metadata updates."""
    try:
        result = execute_safe_retraining(db, force_sample=force_sample, initiated_by="user_pipeline")
        return {
            "status": "success" if result["promoted"] else "warning",
            "message": result["message"],
            "metrics": result.get("metrics"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model retraining failed: {str(e)}")
