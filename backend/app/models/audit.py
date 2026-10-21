from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, Index
from backend.app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_or_system = Column(String(64), nullable=False, default="system")
    action = Column(String(64), nullable=False)  # 'tariff_update', 'model_retrain', 'building_create', 'anomaly_resolve', etc.
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(64), nullable=True)
    details_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        Index("idx_audit_created_desc", created_at.desc()),
    )
