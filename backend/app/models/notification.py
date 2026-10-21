from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from backend.app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(32), nullable=False)  # 'anomaly', 'budget', 'drift', 'training', 'data_import', 'stale_meter'
    severity = Column(String(16), nullable=False, default="info")  # 'info', 'warning', 'critical'
    title = Column(String(128), nullable=False)
    message = Column(String(512), nullable=False)
    link_url = Column(String(128), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        Index("idx_notif_created_desc", created_at.desc()),
    )
