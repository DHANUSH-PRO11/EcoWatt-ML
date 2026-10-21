from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Text, Index
from backend.app.database import Base


class BudgetSetting(Base):
    __tablename__ = "budget_settings"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="CASCADE"), nullable=True, index=True)
    monthly_budget_amount = Column(Float, nullable=False, default=150.0)
    monthly_kwh_target = Column(Float, nullable=True, default=500.0)
    currency = Column(String(8), nullable=False, default="USD")
    # JSON list of alert thresholds, e.g. [80, 90, 100]
    alert_thresholds_json = Column(Text, nullable=False, default="[80, 90, 100]")
    billing_cycle_day = Column(Integer, nullable=False, default=1)  # 1st of month
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
