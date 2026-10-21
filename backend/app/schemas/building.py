from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class EnergyMeterBase(BaseModel):
    meter_code: str = Field(..., json_schema_extra={"example": "MTR-MAIN-001"})
    name: str = Field(..., json_schema_extra={"example": "Main Incomer Grid Meter"})
    meter_type: str = Field(default="main", json_schema_extra={"example": "main"})
    status: str = Field(default="active", json_schema_extra={"example": "active"})


class EnergyMeterCreate(EnergyMeterBase):
    installed_at: Optional[datetime] = None


class EnergyMeterResponse(EnergyMeterBase):
    id: int
    building_id: int
    installed_at: Optional[datetime] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BuildingBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Main Residential Facility"})
    code: str = Field(..., json_schema_extra={"example": "BLD-HQ"})
    building_type: str = Field(default="household", json_schema_extra={"example": "household"})
    location: str = Field(default="Primary Site", json_schema_extra={"example": "Primary Site"})
    description: Optional[str] = Field(default=None, json_schema_extra={"example": "Main building"})
    floor_area_sqm: Optional[float] = Field(default=None, json_schema_extra={"example": 185.0})


class BuildingCreate(BuildingBase):
    pass


class BuildingUpdate(BaseModel):
    name: Optional[str] = None
    building_type: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    floor_area_sqm: Optional[float] = None
    is_active: Optional[bool] = None


class BuildingResponse(BuildingBase):
    id: int
    is_active: bool
    created_at: datetime
    meters: List[EnergyMeterResponse] = []
    model_config = ConfigDict(from_attributes=True)


class BuildingPortfolioMetric(BaseModel):
    building_id: int
    building_name: str
    building_code: str
    building_type: str
    floor_area_sqm: Optional[float] = None
    meter_count: int
    total_consumption_kwh: float
    energy_intensity_kwh_per_sqm: Optional[float] = None
    avg_hourly_kwh: float
    peak_hourly_kwh: float
    active_anomalies_count: int


class PortfolioSummaryResponse(BaseModel):
    total_buildings: int
    total_meters: int
    total_portfolio_consumption_kwh: float
    avg_portfolio_intensity_kwh_per_sqm: Optional[float] = None
    highest_consuming_building: Optional[str] = None
    buildings: List[BuildingPortfolioMetric]
