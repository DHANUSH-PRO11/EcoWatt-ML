from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Index
from backend.app.database import Base


class ForecastRecord(Base):
    __tablename__ = "forecast_records"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="SET NULL"), nullable=True, index=True)
    meter_id = Column(Integer, ForeignKey("energy_meters.id", ondelete="SET NULL"), nullable=True, index=True)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    horizon_hours = Column(Integer, nullable=False)
    target_timestamp = Column(DateTime, nullable=False, index=True)
    predicted_kwh = Column(Float, nullable=False)
    lower_bound_kwh = Column(Float, nullable=False)
    upper_bound_kwh = Column(Float, nullable=False)
    confidence_level = Column(Float, default=0.95, nullable=False)
    model_name = Column(String(64), nullable=False)

    __table_args__ = (
        Index("idx_forecast_target", target_timestamp),
        Index("idx_forecast_generated", generated_at.desc()),
        Index("idx_forecast_building", building_id, target_timestamp),
    )
