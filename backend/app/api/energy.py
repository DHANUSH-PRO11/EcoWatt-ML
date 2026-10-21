from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.energy import EnergyHistoryResponse, EnergyAnalyticsResponse
from backend.app.services.energy_service import get_energy_history, get_energy_analytics

router = APIRouter(prefix="/api/energy", tags=["Energy Data"])


@router.get("/history", response_model=EnergyHistoryResponse)
def read_energy_history(
    start_time: Optional[datetime] = Query(None, description="Start timestamp filter (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="End timestamp filter (ISO format)"),
    limit: int = Query(200, ge=1, le=2000, description="Maximum records to retrieve"),
    building_id: Optional[int] = Query(None, description="Filter readings by building ID"),
    meter_id: Optional[int] = Query(None, description="Filter readings by meter ID"),
    db: Session = Depends(get_db),
):
    """Retrieve chronologically ordered historical energy readings with summary statistics and building/meter filters."""
    try:
        return get_energy_history(
            db,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            building_id=building_id,
            meter_id=meter_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch energy history: {str(e)}")


@router.get("/analytics", response_model=EnergyAnalyticsResponse)
def read_energy_analytics(
    aggregation: str = Query("daily", pattern="^(hourly|daily|monthly)$", description="Aggregation level"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    building_id: Optional[int] = Query(None, description="Filter analytics by building ID"),
    meter_id: Optional[int] = Query(None, description="Filter analytics by meter ID"),
    db: Session = Depends(get_db),
):
    """Retrieve aggregated time-series analytics (hourly, daily, or monthly) with sub-metering breakdown and building/meter filters."""
    try:
        return get_energy_analytics(
            db,
            aggregation=aggregation,
            start_date=start_date,
            end_date=end_date,
            building_id=building_id,
            meter_id=meter_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate analytics: {str(e)}")
