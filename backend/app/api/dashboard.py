from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.dashboard import DashboardSummaryResponse
from backend.app.services.dashboard_service import get_dashboard_summary

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_summary(
    building_id: Optional[int] = Query(None, description="Optional building ID to filter dashboard metrics"),
    db: Session = Depends(get_db),
):
    """Fetch high-level overview metrics, active alerts, and recent trends for the dashboard."""
    try:
        return get_dashboard_summary(db, building_id=building_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard summary: {str(e)}")
