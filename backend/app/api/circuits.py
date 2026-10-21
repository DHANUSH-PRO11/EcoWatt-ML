from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.circuit_service import get_circuit_analytics

router = APIRouter(prefix="/api/circuits", tags=["Circuit & Appliance Analytics"])


@router.get("/analytics")
def read_circuit_analytics(
    building_id: Optional[int] = Query(None, description="Optional building ID"),
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db),
):
    """Retrieve detailed circuit-level telemetry including sub-meter shares, peak hours, and weekday/weekend profiles."""
    try:
        return get_circuit_analytics(db, building_id=building_id, days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch circuit analytics: {str(e)}")
