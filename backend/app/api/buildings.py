from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.schemas.building import (
    BuildingCreate,
    BuildingUpdate,
    BuildingResponse,
    EnergyMeterCreate,
    EnergyMeterResponse,
    PortfolioSummaryResponse,
)
from backend.app.services.building_service import (
    list_buildings,
    get_building_by_id,
    create_building,
    update_building,
    delete_building,
    add_meter,
    get_meters_for_building,
    get_portfolio_summary,
)
from backend.app.models.audit import AuditLog

router = APIRouter(prefix="/api/buildings", tags=["Buildings & Meters"])


@router.get("", response_model=List[BuildingResponse])
def get_all_buildings(include_inactive: bool = False, db: Session = Depends(get_db)):
    """Retrieve all monitored buildings and their registered energy meters."""
    return list_buildings(db, include_inactive=include_inactive)


@router.get("/portfolio/summary", response_model=PortfolioSummaryResponse)
def get_portfolio_overview(db: Session = Depends(get_db)):
    """Retrieve cross-building portfolio metrics including total consumption, kWh/m², and anomaly counts."""
    return get_portfolio_summary(db)


@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(building_id: int, db: Session = Depends(get_db)):
    """Retrieve detailed building configuration by ID."""
    building = get_building_by_id(db, building_id)
    if not building:
        raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found.")
    return building


@router.post("", response_model=BuildingResponse, status_code=status.HTTP_201_CREATED)
def create_new_building(data: BuildingCreate, db: Session = Depends(get_db)):
    """Register a new building with location, type, and square footage."""
    new_bld = create_building(db, data)
    db.add(
        AuditLog(
            user_or_system="user",
            action="building_created",
            resource_type="building",
            resource_id=str(new_bld.id),
            details_json=f'{{"name": "{new_bld.name}", "code": "{new_bld.code}", "type": "{new_bld.building_type}"}}',
        )
    )
    db.commit()
    return new_bld


@router.put("/{building_id}", response_model=BuildingResponse)
def update_existing_building(building_id: int, data: BuildingUpdate, db: Session = Depends(get_db)):
    """Update building metadata or floor area."""
    updated = update_building(db, building_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found.")
    db.add(
        AuditLog(
            user_or_system="user",
            action="building_updated",
            resource_type="building",
            resource_id=str(building_id),
            details_json=f'{{"name": "{updated.name}", "sqm": {updated.floor_area_sqm}}}',
        )
    )
    db.commit()
    return updated


@router.delete("/{building_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_building(building_id: int, db: Session = Depends(get_db)):
    """Delete a building record (restricted to non-primary facilities)."""
    if building_id == 1:
        raise HTTPException(status_code=400, detail="Cannot delete default primary building.")
    success = delete_building(db, building_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found.")
    return None


@router.get("/{building_id}/meters", response_model=List[EnergyMeterResponse])
def get_building_meters(building_id: int, db: Session = Depends(get_db)):
    """Retrieve all meters configured for a specific building."""
    building = get_building_by_id(db, building_id)
    if not building:
        raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found.")
    return get_meters_for_building(db, building_id)


@router.post("/{building_id}/meters", response_model=EnergyMeterResponse, status_code=status.HTTP_201_CREATED)
def register_meter(building_id: int, data: EnergyMeterCreate, db: Session = Depends(get_db)):
    """Register an energy meter to a building."""
    building = get_building_by_id(db, building_id)
    if not building:
        raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found.")
    meter = add_meter(db, building_id, data)
    db.add(
        AuditLog(
            user_or_system="user",
            action="meter_registered",
            resource_type="energy_meter",
            resource_id=str(meter.id),
            details_json=f'{{"meter_code": "{meter.meter_code}", "building_id": {building_id}}}',
        )
    )
    db.commit()
    return meter
