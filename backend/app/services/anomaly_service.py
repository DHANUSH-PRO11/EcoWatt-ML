from datetime import datetime, timezone
from typing import Optional, List
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.models.anomaly import AnomalyAlert
from backend.app.models.energy import EnergyReading
from backend.app.schemas.anomaly import AnomalyItem, AnomalyListResponse
from ml.anomaly import ConsumptionAnomalyDetector


def scan_and_store_anomalies(
    db: Session,
    threshold: float = 0.70,
    lookback_rows: int = 1500,
) -> int:
    """
    Run Isolation Forest across recent energy readings and record newly detected anomalies.
    Prevents duplicate alerts for identical timestamps.
    """
    readings = (
        db.query(EnergyReading)
        .order_by(EnergyReading.timestamp.desc())
        .limit(lookback_rows)
        .all()
    )

    if not readings:
        return 0

    readings = list(reversed(readings))
    df = pd.DataFrame(
        [
            {
                "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "energy_kwh": r.energy_kwh,
            }
            for r in readings
        ]
    )

    detector = ConsumptionAnomalyDetector.load()
    detected = detector.detect_anomalies(df, threshold=threshold)

    # Check existing alert timestamps
    existing_ts = set(
        ts[0]
        for ts in db.query(AnomalyAlert.timestamp).all()
    )

    new_alerts = []
    for alert in detected:
        ts_obj = pd.to_datetime(alert["timestamp"]).to_pydatetime()
        if ts_obj not in existing_ts:
            new_alerts.append(
                AnomalyAlert(
                    timestamp=ts_obj,
                    energy_kwh=alert["energy_kwh"],
                    baseline_kwh=alert["baseline_kwh"],
                    deviation_pct=alert["deviation_pct"],
                    anomaly_score=alert["anomaly_score"],
                    severity=alert["severity"],
                    status="new",
                    explanation=alert["explanation"],
                )
            )

    if new_alerts:
        db.add_all(new_alerts)
        db.commit()

    return len(new_alerts)


def get_anomalies(
    db: Session,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> AnomalyListResponse:
    query = db.query(AnomalyAlert)

    if status and status.lower() != "all":
        query = query.filter(AnomalyAlert.status == status.lower())
    if severity and severity.lower() != "all":
        query = query.filter(AnomalyAlert.severity == severity.lower())

    total = query.count()
    records = query.order_by(AnomalyAlert.timestamp.desc()).offset(offset).limit(limit).all()

    # Aggregate status counts across all alerts
    new_count = db.query(AnomalyAlert).filter(AnomalyAlert.status == "new").count()
    ack_count = db.query(AnomalyAlert).filter(AnomalyAlert.status == "acknowledged").count()
    res_count = db.query(AnomalyAlert).filter(AnomalyAlert.status == "resolved").count()

    items = [
        AnomalyItem(
            id=r.id,
            timestamp=r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            energy_kwh=round(r.energy_kwh, 3),
            baseline_kwh=round(r.baseline_kwh, 3),
            deviation_pct=round(r.deviation_pct, 1),
            anomaly_score=round(r.anomaly_score, 3),
            severity=r.severity,
            status=r.status,
            explanation=r.explanation,
            acknowledged_at=r.acknowledged_at.strftime("%Y-%m-%d %H:%M:%S") if r.acknowledged_at else None,
            resolved_at=r.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if r.resolved_at else None,
            resolution_notes=r.resolution_notes,
        )
        for r in records
    ]

    return AnomalyListResponse(
        total=total,
        new_count=new_count,
        acknowledged_count=ack_count,
        resolved_count=res_count,
        items=items,
    )


def acknowledge_anomaly(db: Session, alert_id: int) -> Optional[AnomalyItem]:
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        return None

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(alert)

    return AnomalyItem(
        id=alert.id,
        timestamp=alert.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        energy_kwh=round(alert.energy_kwh, 3),
        baseline_kwh=round(alert.baseline_kwh, 3),
        deviation_pct=round(alert.deviation_pct, 1),
        anomaly_score=round(alert.anomaly_score, 3),
        severity=alert.severity,
        status=alert.status,
        explanation=alert.explanation,
        acknowledged_at=alert.acknowledged_at.strftime("%Y-%m-%d %H:%M:%S") if alert.acknowledged_at else None,
        resolved_at=alert.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if alert.resolved_at else None,
        resolution_notes=alert.resolution_notes,
    )


def resolve_anomaly(db: Session, alert_id: int, resolution_notes: Optional[str] = None) -> Optional[AnomalyItem]:
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        return None

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_notes = resolution_notes or "Marked resolved by operator inspection"
    db.commit()
    db.refresh(alert)

    return AnomalyItem(
        id=alert.id,
        timestamp=alert.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        energy_kwh=round(alert.energy_kwh, 3),
        baseline_kwh=round(alert.baseline_kwh, 3),
        deviation_pct=round(alert.deviation_pct, 1),
        anomaly_score=round(alert.anomaly_score, 3),
        severity=alert.severity,
        status=alert.status,
        explanation=alert.explanation,
        acknowledged_at=alert.acknowledged_at.strftime("%Y-%m-%d %H:%M:%S") if alert.acknowledged_at else None,
        resolved_at=alert.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if alert.resolved_at else None,
        resolution_notes=alert.resolution_notes,
    )
