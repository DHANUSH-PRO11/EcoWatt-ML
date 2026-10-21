from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.app.database import Base


class Building(Base):
    __tablename__ = "buildings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    code = Column(String(32), unique=True, index=True, nullable=False)
    building_type = Column(String(32), nullable=False, default="household")
    # 'household', 'classroom', 'laboratory', 'office', 'commercial'
    location = Column(String(128), nullable=False, default="Main Campus / Residential")
    description = Column(String(256), nullable=True)
    floor_area_sqm = Column(Float, nullable=True)  # Square metres for energy intensity calculations
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    meters = relationship("EnergyMeter", back_populates="building", cascade="all, delete-orphan")


class EnergyMeter(Base):
    __tablename__ = "energy_meters"

    id = Column(Integer, primary_key=True, index=True)
    meter_code = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(128), nullable=False)
    building_id = Column(Integer, ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False, index=True)
    meter_type = Column(String(32), default="main", nullable=False)  # 'main', 'submeter', 'solar', 'hvac'
    status = Column(String(32), default="active", nullable=False)  # 'active', 'inactive', 'maintenance'
    installed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    building = relationship("Building", back_populates="meters")
