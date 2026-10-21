from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.carbon_service import (
    get_carbon_settings,
    update_carbon_settings,
    get_carbon_analytics,
)

router = APIRouter(prefix="/api/carbon", tags=["Carbon Analytics"])


class UpdateCarbonSettingsRequest(BaseModel):
    emissions_factor_kg_per_kwh: float = Field(..., ge=0.001, le=5.0, description="Emissions factor in kg CO2e / kWh")
    factor_source: str = Field(..., max_length=128, description="Source or authority for emissions factor")
    building_id: Optional[int] = None


@router.get("/analytics")
def read_carbon_analytics(
    building_id: Optional[int] = Query(None, description="Optional building ID"),
    days: int = Query(30, ge=1, le=180),
    db: Session = Depends(get_db),
):
    """Retrieve measured and forecasted CO2e emissions with historical trends and cross-building breakdowns."""
    try:
        return get_carbon_analytics(db, building_id=building_id, days=days)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch carbon analytics: {str(e)}")


@router.get("/settings")
def read_carbon_settings(
    building_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Retrieve active emissions factor and source."""
    s = get_carbon_settings(db, building_id)
    return {
        "id": s.id,
        "building_id": s.building_id,
        "emissions_factor_kg_per_kwh": s.emissions_factor_kg_per_kwh,
        "factor_source": s.factor_source,
    }


@router.put("/settings")
def save_carbon_settings(
    request: UpdateCarbonSettingsRequest,
    db: Session = Depends(get_db),
):
    """Configure electricity grid emissions factor and citation source."""
    s = update_carbon_settings(
        db,
        emissions_factor_kg_per_kwh=request.emissions_factor_kg_per_kwh,
        factor_source=request.factor_source,
        building_id=request.building_id,
    )
    return {
        "status": "success",
        "emissions_factor_kg_per_kwh": s.emissions_factor_kg_per_kwh,
        "factor_source": s.factor_source,
    }
