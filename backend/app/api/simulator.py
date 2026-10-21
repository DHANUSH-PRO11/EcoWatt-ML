from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.simulator_service import run_energy_simulation

router = APIRouter(prefix="/api/simulator", tags=["Energy Simulator"])


class SimulationRequest(BaseModel):
    reduction_pct: float = Field(10.0, ge=0.0, le=60.0, description="Overall reduction percentage target")
    daily_kwh_target: Optional[float] = Field(None, ge=1.0, description="Optional daily kWh target limit")
    shift_peak_to_offpeak_pct: float = Field(0.0, ge=0.0, le=80.0, description="Percentage of peak load to shift")
    weekend_reduction_pct: float = Field(0.0, ge=0.0, le=60.0, description="Additional weekend reduction percentage")
    billing_period_days: int = Field(30, ge=1, le=365)
    building_id: Optional[int] = None


@router.post("/run")
def execute_simulation(
    request: SimulationRequest,
    db: Session = Depends(get_db),
):
    """
    Run interactive what-if energy scenario simulation.
    Calculates transparent kWh, financial savings, and emissions reduction without altering records.
    """
    try:
        return run_energy_simulation(
            db=db,
            reduction_pct=request.reduction_pct,
            daily_kwh_target=request.daily_kwh_target,
            shift_peak_to_offpeak_pct=request.shift_peak_to_offpeak_pct,
            weekend_reduction_pct=request.weekend_reduction_pct,
            billing_period_days=request.billing_period_days,
            building_id=request.building_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")
