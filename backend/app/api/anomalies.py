from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.anomaly import (
    AnomalyItem,
    AnomalyListResponse,
    AnomalyResolveRequest,
    AnomalyFeedbackRequest,
    AnomalyInvestigationResponse,
    AnomalyStatsResponse,
)
from backend.app.services.anomaly_service import (
    get_anomalies,
    acknowledge_anomaly,
    resolve_anomaly,
    scan_and_store_anomalies,
    investigate_anomaly,
    update_anomaly_feedback,
    get_anomaly_stats,
)
from backend.app.models.audit import AuditLog

router = APIRouter(prefix="/api/anomalies", tags=["Anomaly Monitoring"])


@router.get("", response_model=AnomalyListResponse)
def list_anomalies(
    status: Optional[str] = Query(None, description="Filter by status ('new', 'acknowledged', 'resolved', 'false_positive', 'all')"),
    severity: Optional[str] = Query(None, description="Filter by severity ('low', 'medium', 'high', 'critical', 'all')"),
    building_id: Optional[int] = Query(None, description="Filter anomalies by building ID"),
    meter_id: Optional[int] = Query(None, description="Filter anomalies by meter ID"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieve detected consumption anomaly alerts with optional building, severity, and lifecycle status filters."""
    return get_anomalies(
        db,
        status=status,
        severity=severity,
        building_id=building_id,
        meter_id=meter_id,
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=AnomalyStatsResponse)
def get_stats(
    building_id: Optional[int] = Query(None, description="Optional building ID filter"),
    db: Session = Depends(get_db),
):
    """Retrieve aggregate statistics for anomalies across status, severity, and buildings."""
    return get_anomaly_stats(db, building_id=building_id)


@router.get("/{id}/investigate", response_model=AnomalyInvestigationResponse)
def investigate_alert(
    id: int = Path(..., description="ID of the anomaly alert"),
    db: Session = Depends(get_db),
):
    """Retrieve deep investigation context including +/-24h readings, typical time-slot baseline, and building info."""
    result = investigate_anomaly(db, alert_id=id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Anomaly alert with ID {id} not found")
    return result


@router.post("/scan")
def trigger_anomaly_scan(
    threshold: float = Query(0.70, ge=0.5, le=0.95),
    building_id: Optional[int] = Query(None, description="Optional building ID to scan"),
    db: Session = Depends(get_db),
):
    """Trigger manual anomaly scan using the fitted Isolation Forest detector."""
    try:
        count = scan_and_store_anomalies(db, threshold=threshold, building_id=building_id)
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
    db.add(
        AuditLog(
            user_or_system="operator",
            action="anomaly_acknowledged",
            resource_type="anomaly_alert",
            resource_id=str(id),
            details_json=f'{{"status": "acknowledged"}}',
        )
    )
    db.commit()
    return alert


@router.post("/{id}/resolve", response_model=AnomalyItem)
def resolve_alert(
    id: int = Path(..., description="ID of the anomaly alert"),
    request: Optional[AnomalyResolveRequest] = None,
    db: Session = Depends(get_db),
):
    """Resolve an anomaly alert with optional operator notes."""
    notes = request.resolution_notes if request else "Resolved by operator inspection"
    user_name = request.user_name if request and request.user_name else "operator"
    alert = resolve_anomaly(db, alert_id=id, resolution_notes=notes, user_name=user_name)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Anomaly alert with ID {id} not found")
    db.add(
        AuditLog(
            user_or_system=user_name,
            action="anomaly_resolved",
            resource_type="anomaly_alert",
            resource_id=str(id),
            details_json=f'{{"resolution_notes": "{notes}"}}',
        )
    )
    db.commit()
    return alert


@router.post("/{id}/feedback", response_model=AnomalyItem)
def provide_feedback(
    id: int = Path(..., description="ID of the anomaly alert"),
    request: AnomalyFeedbackRequest = None,
    db: Session = Depends(get_db),
):
    """Submit false-positive or investigation feedback for future model diagnostics."""
    if not request:
        raise HTTPException(status_code=400, detail="Missing feedback request body")
    alert = update_anomaly_feedback(
        db,
        alert_id=id,
        false_positive=request.false_positive,
        investigation_notes=request.investigation_notes,
        user_name=request.user_name or "operator",
    )
    if not alert:
        raise HTTPException(status_code=404, detail=f"Anomaly alert with ID {id} not found")
    db.add(
        AuditLog(
            user_or_system=request.user_name or "operator",
            action="anomaly_feedback_submitted",
            resource_type="anomaly_alert",
            resource_id=str(id),
            details_json=f'{{"false_positive": {str(request.false_positive).lower()}, "notes": "{request.investigation_notes}"}}',
        )
    )
    db.commit()
    return alert
