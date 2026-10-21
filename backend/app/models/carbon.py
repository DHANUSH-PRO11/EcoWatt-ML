from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from backend.app.database import Base


class CarbonSetting(Base):
    __tablename__ = "carbon_settings"

    id = Column(Integer, primary_key=True, index=True)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="CASCADE"), nullable=True, index=True)
    emissions_factor_kg_per_kwh = Column(Float, nullable=False, default=0.385)  # e.g. 0.385 kg CO2e/kWh US grid avg
    factor_source = Column(String(128), nullable=False, default="US EPA eGRID National Average (2024)")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
