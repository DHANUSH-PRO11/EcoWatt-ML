from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.advanced_analytics_service import (
    get_period_comparisons,
    get_consumption_heatmap,
    get_baseload_and_peak_analysis,
)

router = APIRouter(prefix="/api/analytics/advanced", tags=["Advanced Analytics"])


@router.get("/comparisons")
def read_comparisons(
    building_id: Optional[int] = Query(None, description="Optional building ID"),
    db: Session = Depends(get_db),
):
    """Retrieve Day-over-Day, Week-over-Week, Month-over-Month, and Weekend vs Weekday comparisons."""
    return get_period_comparisons(db, building_id=building_id)


@router.get("/heatmap")
def read_heatmap(
    building_id: Optional[int] = Query(None, description="Optional building ID"),
    db: Session = Depends(get_db),
):
    """Retrieve a 7-day x 24-hour matrix of mean hourly consumption for heatmap visualization."""
    return get_consumption_heatmap(db, building_id=building_id)


@router.get("/baseload-peak")
def read_baseload_peak(
    building_id: Optional[int] = Query(None, description="Optional building ID"),
    db: Session = Depends(get_db),
):
    """Retrieve baseload (1-5 AM) and peak (6-9 PM) metrics with baseload-to-peak ratio."""
    return get_baseload_and_peak_analysis(db, building_id=building_id)
