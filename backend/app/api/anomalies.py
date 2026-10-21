from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.anomaly import (
    AnomalyItem,
    AnomalyListResponse,
    AnomalyResolveRequest,
)
from backend.app.services.anomaly_service import (
    get_anomalies,
    acknowledge_anomaly,
    resolve_anomaly,
    scan_and_store_anomalies,
)

router = APIRouter(prefix="/api/anomalies", tags=["Anomaly Monitoring"])


@router.get("", response_model=AnomalyListResponse)
def list_anomalies(
    status: Optional[str] = Query(None, description="Filter by status ('new', 'acknowledged', 'resolved', 'all')"),
    severity: Optional[str] = Query(None, description="Filter by severity ('low', 'medium', 'high', 'critical', 'all')"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieve detected consumption anomaly alerts with optional severity and lifecycle status filters."""
    return get_anomalies(db, status=status, severity=severity, limit=limit, offset=offset)


@router.post("/scan")
def trigger_anomaly_scan(
    threshold: float = Query(0.70, ge=0.5, le=0.95),
    db: Session = Depends(get_db),
):
    """Trigger manual anomaly scan using the fitted Isolation Forest detector."""
    try:
        count = scan_and_store_anomalies(db, threshold=threshold)
        return {"message": f"Scan completed. {count} new anomaly alerts detected."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly scan failed: {str(e)}")


@router.post("/{id}/acknowledge", response_model=AnomalyItem)
def acknowledge_alert(
    id: int = Path(..., description="ID of the anomaly alert"),
    db: Session = Depends(get_db),
):
    """Acknowledge an anomaly alert."""
    alert = acknowledge_anomaly(db, alert_id=id)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Anomaly alert with ID {id} not found")
    return alert


@router.post("/{id}/resolve", response_model=AnomalyItem)
def resolve_alert(
    id: int = Path(..., description="ID of the anomaly alert"),
    request: AnomalyResolveRequest = None,
    db: Session = Depends(get_db),
):
    """Resolve an anomaly alert with optional operator notes."""
    notes = request.resolution_notes if request else "Resolved by operator"
    alert = resolve_anomaly(db, alert_id=id, resolution_notes=notes)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Anomaly alert with ID {id} not found")
    return alert
