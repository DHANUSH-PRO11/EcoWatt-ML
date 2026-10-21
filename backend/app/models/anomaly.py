from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime, Index
from backend.app.database import Base


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    energy_kwh = Column(Float, nullable=False)
    baseline_kwh = Column(Float, nullable=False)
    deviation_pct = Column(Float, nullable=False)
    anomaly_score = Column(Float, nullable=False)
    severity = Column(String(32), nullable=False)  # 'low', 'medium', 'high', 'critical'
    status = Column(String(32), default="new", nullable=False)  # 'new', 'acknowledged', 'resolved'
    explanation = Column(String(512), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_anomaly_status", status),
        Index("idx_anomaly_severity", severity),
    )
