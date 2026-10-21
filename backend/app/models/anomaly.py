from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Index, Text
from backend.app.database import Base


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True, index=True)
    meter_id = Column(Integer, ForeignKey("energy_meters.id", ondelete="SET NULL"), nullable=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    energy_kwh = Column(Float, nullable=False)
    baseline_kwh = Column(Float, nullable=False)
    deviation_pct = Column(Float, nullable=False)
    anomaly_score = Column(Float, nullable=False)
    severity = Column(String(32), nullable=False)  # 'low', 'medium', 'high', 'critical'
    status = Column(String(32), default="new", nullable=False)  # 'new', 'acknowledged', 'investigating', 'resolved', 'false_positive'
    explanation = Column(String(512), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(String(512), nullable=True)
    investigation_notes = Column(Text, nullable=True)
    false_positive = Column(Boolean, default=False, nullable=False)
    updated_by = Column(String(64), default="system", nullable=False)
    detector_version = Column(String(32), default="1.0.0", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_anomaly_status", status),
        Index("idx_anomaly_severity", severity),
        Index("idx_anomaly_building_time", building_id, timestamp.desc()),
    )
