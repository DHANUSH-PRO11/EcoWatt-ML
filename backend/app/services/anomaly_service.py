from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_

from backend.app.models.anomaly import AnomalyAlert
from backend.app.models.energy import EnergyReading
from backend.app.models.building import Building, EnergyMeter
from backend.app.schemas.anomaly import (
    AnomalyItem,
    AnomalyListResponse,
    AnomalyInvestigationResponse,
    AnomalySurroundingPoint,
    AnomalyStatsResponse,
    AnomalySeverityCount,
)
from ml.anomaly import ConsumptionAnomalyDetector


def scan_and_store_anomalies(
    db: Session,
    threshold: float = 0.70,
    lookback_rows: int = 1500,
    building_id: Optional[int] = None,
    meter_id: Optional[int] = None,
) -> int:
    """
    Run Isolation Forest across recent energy readings and record newly detected anomalies.
    Prevents duplicate alerts for identical timestamps and detector versions.
    """
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)
    if meter_id:
        query = query.filter(EnergyReading.meter_id == meter_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(lookback_rows).all()
    if not readings:
        return 0

    readings = list(reversed(readings))
    df = pd.DataFrame(
        [
            {
                "timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "energy_kwh": r.energy_kwh,
                "building_id": r.building_id or 1,
                "meter_id": r.meter_id or 1,
            }
            for r in readings
        ]
    )

    detector = ConsumptionAnomalyDetector.load()
    detected = detector.detect_anomalies(df, threshold=threshold)

    # Check existing alert timestamps to avoid duplicate alerts
    existing_alerts = db.query(AnomalyAlert.timestamp, AnomalyAlert.building_id, AnomalyAlert.detector_version).all()
    existing_set = {(r[0], r[1] or 1, r[2] or "1.0.0") for r in existing_alerts}

    new_alerts = []
    for alert in detected:
        ts_obj = pd.to_datetime(alert["timestamp"]).to_pydatetime()
        target_bld_id = building_id or 1
        detector_ver = "1.0.0"

        if (ts_obj, target_bld_id, detector_ver) not in existing_set:
            new_alerts.append(
                AnomalyAlert(
                    building_id=target_bld_id,
                    meter_id=meter_id or 1,
                    timestamp=ts_obj,
                    energy_kwh=alert["energy_kwh"],
                    baseline_kwh=alert["baseline_kwh"],
                    deviation_pct=alert["deviation_pct"],
                    anomaly_score=alert["anomaly_score"],
                    severity=alert["severity"],
                    status="new",
                    explanation=alert["explanation"],
                    detector_version=detector_ver,
                    false_positive=False,
                )
            )

    if new_alerts:
        db.add_all(new_alerts)
        db.commit()

    return len(new_alerts)


def _to_item(r: AnomalyAlert) -> AnomalyItem:
    return AnomalyItem(
        id=r.id,
        building_id=r.building_id,
        meter_id=r.meter_id,
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
        investigation_notes=r.investigation_notes,
        false_positive=bool(r.false_positive),
        updated_by=r.updated_by,
        detector_version=r.detector_version,
    )


def get_anomalies(
    db: Session,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    building_id: Optional[int] = None,
    meter_id: Optional[int] = None,
    limit: int = 100,
    offset: int = 0,
) -> AnomalyListResponse:
    query = db.query(AnomalyAlert)

    if building_id:
        query = query.filter(AnomalyAlert.building_id == building_id)
    if meter_id:
        query = query.filter(AnomalyAlert.meter_id == meter_id)
    if status and status.lower() != "all":
        query = query.filter(AnomalyAlert.status == status.lower())
    if severity and severity.lower() != "all":
        query = query.filter(AnomalyAlert.severity == severity.lower())

    total = query.count()
    records = query.order_by(AnomalyAlert.timestamp.desc()).offset(offset).limit(limit).all()

    # Aggregate status counts across active filter scope
    cnt_query = db.query(AnomalyAlert)
    if building_id:
        cnt_query = cnt_query.filter(AnomalyAlert.building_id == building_id)

    new_count = cnt_query.filter(AnomalyAlert.status == "new").count()
    ack_count = cnt_query.filter(AnomalyAlert.status == "acknowledged").count()
    res_count = cnt_query.filter(AnomalyAlert.status == "resolved").count()
    fp_count = cnt_query.filter(AnomalyAlert.false_positive == True).count()

    items = [_to_item(r) for r in records]

    return AnomalyListResponse(
        total=total,
        new_count=new_count,
        acknowledged_count=ack_count,
        resolved_count=res_count,
        false_positive_count=fp_count,
        items=items,
    )


def acknowledge_anomaly(db: Session, alert_id: int, user_name: str = "operator") -> Optional[AnomalyItem]:
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        return None

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.updated_by = user_name
    db.commit()
    db.refresh(alert)
    return _to_item(alert)


def resolve_anomaly(db: Session, alert_id: int, resolution_notes: Optional[str] = None, user_name: str = "operator") -> Optional[AnomalyItem]:
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        return None

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_notes = resolution_notes or "Marked resolved by operator inspection"
    alert.updated_by = user_name
    db.commit()
    db.refresh(alert)
    return _to_item(alert)


def update_anomaly_feedback(
    db: Session,
    alert_id: int,
    false_positive: bool,
    investigation_notes: Optional[str] = None,
    user_name: str = "operator",
) -> Optional[AnomalyItem]:
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        return None

    alert.false_positive = false_positive
    if false_positive:
        alert.status = "false_positive"
    if investigation_notes:
        alert.investigation_notes = investigation_notes
    alert.updated_by = user_name
    db.commit()
    db.refresh(alert)
    return _to_item(alert)


def investigate_anomaly(db: Session, alert_id: int) -> Optional[AnomalyInvestigationResponse]:
    alert = db.query(AnomalyAlert).filter(AnomalyAlert.id == alert_id).first()
    if not alert:
        return None

    # Fetch building and meter details
    bld_name = "Primary Residential Facility"
    meter_code = "MTR-MAIN-001"
    if alert.building_id:
        bld = db.query(Building).filter(Building.id == alert.building_id).first()
        if bld:
            bld_name = bld.name
    if alert.meter_id:
        mtr = db.query(EnergyMeter).filter(EnergyMeter.id == alert.meter_id).first()
        if mtr:
            meter_code = mtr.meter_code

    # Fetch surrounding +/- 24 hours of readings
    start_window = alert.timestamp - timedelta(hours=24)
    end_window = alert.timestamp + timedelta(hours=24)

    surrounding = (
        db.query(EnergyReading)
        .filter(
            EnergyReading.timestamp >= start_window,
            EnergyReading.timestamp <= end_window,
        )
        .order_by(EnergyReading.timestamp.asc())
        .all()
    )

    points = []
    for r in surrounding:
        is_event = (r.timestamp == alert.timestamp)
        points.append(
            AnomalySurroundingPoint(
                timestamp=r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                energy_kwh=round(r.energy_kwh, 3),
                is_event=is_event,
            )
        )

    # Compute historical typical consumption for the same weekday and hour
    event_dow = alert.timestamp.weekday()
    event_hour = alert.timestamp.hour

    all_readings = db.query(EnergyReading.timestamp, EnergyReading.energy_kwh).all()
    matching_values = [
        r[1]
        for r in all_readings
        if r[0].weekday() == event_dow and r[0].hour == event_hour
    ]

    typical_mean = float(np.mean(matching_values)) if matching_values else alert.baseline_kwh
    typical_std = float(np.std(matching_values)) if len(matching_values) > 1 else 0.15

    return AnomalyInvestigationResponse(
        alert=_to_item(alert),
        building_name=bld_name,
        meter_code=meter_code,
        same_slot_typical_kwh=round(typical_mean, 3),
        same_slot_std_kwh=round(typical_std, 3),
        surrounding_readings=points,
    )


def get_anomaly_stats(db: Session, building_id: Optional[int] = None) -> AnomalyStatsResponse:
    query = db.query(AnomalyAlert)
    if building_id:
        query = query.filter(AnomalyAlert.building_id == building_id)

    total = query.count()
    new_count = query.filter(AnomalyAlert.status == "new").count()
    ack_count = query.filter(AnomalyAlert.status == "acknowledged").count()
    res_count = query.filter(AnomalyAlert.status == "resolved").count()
    fp_count = query.filter(AnomalyAlert.false_positive == True).count()

    # By severity
    low = query.filter(AnomalyAlert.severity == "low").count()
    med = query.filter(AnomalyAlert.severity == "medium").count()
    high = query.filter(AnomalyAlert.severity == "high").count()
    crit = query.filter(AnomalyAlert.severity == "critical").count()

    # By building
    by_bld: Dict[str, int] = {}
    buildings = db.query(Building).all()
    for b in buildings:
        cnt = db.query(AnomalyAlert).filter(AnomalyAlert.building_id == b.id).count()
        by_bld[b.name] = cnt

    return AnomalyStatsResponse(
        total_anomalies=total,
        new_count=new_count,
        acknowledged_count=ack_count,
        resolved_count=res_count,
        false_positive_count=fp_count,
        by_severity=AnomalySeverityCount(low=low, medium=med, high=high, critical=crit),
        by_building=by_bld,
    )
