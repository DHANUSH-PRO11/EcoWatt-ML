from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Index
from backend.app.database import Base


class EnergyReading(Base):
    __tablename__ = "energy_readings"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, unique=True, index=True)
    energy_kwh = Column(Float, nullable=False)
    reactive_power_kvar = Column(Float, nullable=True)
    voltage = Column(Float, nullable=True)
    global_intensity = Column(Float, nullable=True)
    sub_metering_1_kwh = Column(Float, nullable=True)
    sub_metering_2_kwh = Column(Float, nullable=True)
    sub_metering_3_kwh = Column(Float, nullable=True)
    sub_metering_other_kwh = Column(Float, nullable=True)
    is_simulated = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("idx_energy_timestamp_desc", timestamp.desc()),
    )
