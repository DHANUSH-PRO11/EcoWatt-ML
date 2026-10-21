from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from backend.app.models.building import Building, EnergyMeter
from backend.app.models.energy import EnergyReading
from backend.app.models.anomaly import AnomalyAlert
from backend.app.schemas.building import (
    BuildingCreate,
    BuildingUpdate,
    EnergyMeterCreate,
    PortfolioSummaryResponse,
    BuildingPortfolioMetric,
)


def list_buildings(db: Session, include_inactive: bool = False) -> List[Building]:
    query = db.query(Building)
    if not include_inactive:
        query = query.filter(Building.is_active == True)
    return query.order_by(Building.id.asc()).all()


def get_building_by_id(db: Session, building_id: int) -> Optional[Building]:
    return db.query(Building).filter(Building.id == building_id).first()


def create_building(db: Session, data: BuildingCreate) -> Building:
    building = Building(
        name=data.name,
        code=data.code.upper(),
        building_type=data.building_type.lower(),
        location=data.location,
        description=data.description,
        floor_area_sqm=data.floor_area_sqm,
    )
    db.add(building)
    db.commit()
    db.refresh(building)

    # Automatically generate default main meter for new building
    default_meter = EnergyMeter(
        meter_code=f"MTR-{building.code}-01",
        name=f"{building.name} Main Feeder",
        building_id=building.id,
        meter_type="main",
        status="active",
    )
    db.add(default_meter)
    db.commit()
    db.refresh(building)
    return building


def update_building(db: Session, building_id: int, data: BuildingUpdate) -> Optional[Building]:
    building = get_building_by_id(db, building_id)
    if not building:
        return None

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        if field == "code" and value:
            setattr(building, field, value.upper())
        elif field == "building_type" and value:
            setattr(building, field, value.lower())
        else:
            setattr(building, field, value)

    db.commit()
    db.refresh(building)
    return building


def delete_building(db: Session, building_id: int) -> bool:
    building = get_building_by_id(db, building_id)
    if not building:
        return False
    db.delete(building)
    db.commit()
    return True


def add_meter(db: Session, building_id: int, data: EnergyMeterCreate) -> EnergyMeter:
    meter = EnergyMeter(
        meter_code=data.meter_code.upper(),
        name=data.name,
        building_id=building_id,
        meter_type=data.meter_type.lower(),
        status=data.status.lower(),
        installed_at=data.installed_at,
    )
    db.add(meter)
    db.commit()
    db.refresh(meter)
    return meter


def get_meters_for_building(db: Session, building_id: int) -> List[EnergyMeter]:
    return db.query(EnergyMeter).filter(EnergyMeter.building_id == building_id).all()


def get_portfolio_summary(db: Session) -> PortfolioSummaryResponse:
    buildings = db.query(Building).filter(Building.is_active == True).all()
    metrics: List[BuildingPortfolioMetric] = []

    total_portfolio_kwh = 0.0
    highest_kwh = -1.0
    highest_bld_name = None

    for b in buildings:
        # Sum consumption for building
        stats = db.query(
            func.coalesce(func.sum(EnergyReading.energy_kwh), 0.0).label("total_kwh"),
            func.coalesce(func.avg(EnergyReading.energy_kwh), 0.0).label("avg_kwh"),
            func.coalesce(func.max(EnergyReading.energy_kwh), 0.0).label("peak_kwh"),
        ).filter(EnergyReading.building_id == b.id).first()

        total_bld_kwh = round(float(stats.total_kwh), 2)
        avg_bld_kwh = round(float(stats.avg_kwh), 3)
        peak_bld_kwh = round(float(stats.peak_kwh), 3)

        # Intensity per sqm
        intensity = None
        if b.floor_area_sqm and b.floor_area_sqm > 0:
            intensity = round(total_bld_kwh / b.floor_area_sqm, 2)

        # Active anomalies
        active_anoms = db.query(AnomalyAlert).filter(
            AnomalyAlert.building_id == b.id,
            AnomalyAlert.status.in_(["new", "acknowledged", "investigating"])
        ).count()

        meter_count = db.query(EnergyMeter).filter(EnergyMeter.building_id == b.id).count()

        metrics.append(
            BuildingPortfolioMetric(
                building_id=b.id,
                building_name=b.name,
                building_code=b.code,
                building_type=b.building_type,
                floor_area_sqm=b.floor_area_sqm,
                meter_count=meter_count,
                total_consumption_kwh=total_bld_kwh,
                energy_intensity_kwh_per_sqm=intensity,
                avg_hourly_kwh=avg_bld_kwh,
                peak_hourly_kwh=peak_bld_kwh,
                active_anomalies_count=active_anoms,
            )
        )

        total_portfolio_kwh += total_bld_kwh
        if total_bld_kwh > highest_kwh:
            highest_kwh = total_bld_kwh
            highest_bld_name = b.name

    total_meters = db.query(EnergyMeter).count()

    # Portfolio average intensity
    total_area = sum([b.floor_area_sqm for b in buildings if b.floor_area_sqm and b.floor_area_sqm > 0])
    avg_portfolio_intensity = None
    if total_area > 0 and total_portfolio_kwh > 0:
        avg_portfolio_intensity = round(total_portfolio_kwh / total_area, 2)

    return PortfolioSummaryResponse(
        total_buildings=len(buildings),
        total_meters=total_meters,
        total_portfolio_consumption_kwh=round(total_portfolio_kwh, 2),
        avg_portfolio_intensity_kwh_per_sqm=avg_portfolio_intensity,
        highest_consuming_building=highest_bld_name,
        buildings=metrics,
    )
