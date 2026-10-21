from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.budget_service import (
    get_or_create_budget,
    update_budget,
    get_budget_forecast_status,
)
from backend.app.models.audit import AuditLog

router = APIRouter(prefix="/api/budget", tags=["Budget & Cost Forecasting"])


class UpdateBudgetRequest(BaseModel):
    building_id: Optional[int] = None
    monthly_budget_amount: Optional[float] = Field(None, ge=1.0)
    monthly_kwh_target: Optional[float] = Field(None, ge=1.0)
    billing_cycle_day: Optional[int] = Field(None, ge=1, le=28)
    alert_thresholds: Optional[List[int]] = None


@router.get("/status")
def read_budget_status(
    building_id: Optional[int] = Query(None, description="Optional building ID"),
    db: Session = Depends(get_db),
):
    """Retrieve MTD consumption, remaining cycle forecast, budget consumption percentage, and threshold alerts."""
    try:
        return get_budget_forecast_status(db, building_id=building_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate budget status: {str(e)}")


@router.get("/settings")
def read_budget_settings(
    building_id: Optional[int] = Query(None, description="Optional building ID"),
    db: Session = Depends(get_db),
):
    """Retrieve configured budget amount and cycle settings."""
    b = get_or_create_budget(db, building_id)
    return {
        "id": b.id,
        "building_id": b.building_id,
        "monthly_budget_amount": b.monthly_budget_amount,
        "monthly_kwh_target": b.monthly_kwh_target,
        "currency": b.currency,
        "billing_cycle_day": b.billing_cycle_day,
        "alert_thresholds_json": b.alert_thresholds_json,
    }


@router.put("/settings")
def save_budget_settings(
    request: UpdateBudgetRequest,
    db: Session = Depends(get_db),
):
    """Update monthly energy budget and alert thresholds."""
    b = update_budget(
        db,
        building_id=request.building_id,
        monthly_budget_amount=request.monthly_budget_amount,
        monthly_kwh_target=request.monthly_kwh_target,
        billing_cycle_day=request.billing_cycle_day,
        alert_thresholds=request.alert_thresholds,
    )
    db.add(
        AuditLog(
            user_or_system="operator",
            action="budget_settings_updated",
            resource_type="budget_settings",
            resource_id=str(b.id),
            details_json=f'{{"budget": {b.monthly_budget_amount}, "target_kwh": {b.monthly_kwh_target}}}',
        )
    )
    db.commit()
    return {
        "status": "success",
        "monthly_budget_amount": b.monthly_budget_amount,
        "monthly_kwh_target": b.monthly_kwh_target,
        "billing_cycle_day": b.billing_cycle_day,
    }
