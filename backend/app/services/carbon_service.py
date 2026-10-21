from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.models.carbon import CarbonSetting
from backend.app.models.energy import EnergyReading
from backend.app.models.forecast import ForecastRecord
from backend.app.models.building import Building
from backend.app.models.audit import AuditLog


def get_carbon_settings(db: Session, building_id: Optional[int] = None) -> CarbonSetting:
    setting = db.query(CarbonSetting).filter(CarbonSetting.building_id == building_id).first()
    if not setting:
        setting = db.query(CarbonSetting).first()
    if not setting:
        setting = CarbonSetting(
            building_id=building_id,
            emissions_factor_kg_per_kwh=0.385,
            factor_source="US EPA eGRID National Average (2024)",
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def update_carbon_settings(
    db: Session,
    emissions_factor_kg_per_kwh: float,
    factor_source: str,
    building_id: Optional[int] = None,
) -> CarbonSetting:
    setting = get_carbon_settings(db, building_id)
    setting.emissions_factor_kg_per_kwh = max(0.001, emissions_factor_kg_per_kwh)
    setting.factor_source = factor_source
    db.commit()
    db.refresh(setting)

    db.add(
        AuditLog(
            user_or_system="operator",
            action="carbon_factor_updated",
            resource_type="carbon_settings",
            resource_id=str(setting.id),
            details_json=f'{{"factor": {setting.emissions_factor_kg_per_kwh}, "source": "{factor_source}"}}',
        )
    )
    db.commit()
    return setting


def get_carbon_analytics(
    db: Session,
    building_id: Optional[int] = None,
    days: int = 30,
) -> Dict[str, Any]:
    """
    Computes measured and forecasted greenhouse gas emissions (kg CO2e)
    using the actively configured grid emissions factor.
    """
    setting = get_carbon_settings(db, building_id)
    factor = setting.emissions_factor_kg_per_kwh

    # Fetch readings
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(days * 24).all()
    if not readings:
        return {
            "emissions_factor_kg_per_kwh": factor,
            "factor_source": setting.factor_source,
            "total_emissions_kg_co2e": 0.0,
            "daily_avg_emissions_kg_co2e": 0.0,
            "forecast_emissions_next_7d_kg_co2e": 0.0,
            "series": [],
            "emissions_by_building": [],
            "disclaimer": "All carbon figures are estimates based on user-configured electricity grid emissions factors.",
        }

    readings = list(reversed(readings))
    df = pd.DataFrame([{"timestamp": r.timestamp, "energy_kwh": r.energy_kwh} for r in readings])
    df["date"] = df["timestamp"].dt.date

    daily = df.groupby("date")["energy_kwh"].sum().reset_index()
    daily["emissions_kg"] = daily["energy_kwh"] * factor

    series = [
        {
            "date": str(r["date"]),
            "energy_kwh": round(float(r["energy_kwh"]), 2),
            "emissions_kg_co2e": round(float(r["emissions_kg"]), 2),
        }
        for _, r in daily.iterrows()
    ]

    total_kwh = float(df["energy_kwh"].sum())
    total_emissions = round(total_kwh * factor, 2)
    daily_avg = round(total_emissions / max(1, len(daily)), 2)

    # 7-day forecast emissions
    forecast_query = db.query(ForecastRecord).order_by(ForecastRecord.target_timestamp.desc()).limit(168).all()
    forecast_kwh = sum(r.predicted_kwh for r in forecast_query) if forecast_query else (daily_avg / factor * 7.0)
    forecast_emissions_7d = round(forecast_kwh * factor, 2)

    # Cross-building emissions comparison
    bld_emissions = []
    buildings = db.query(Building).filter(Building.is_active == True).all()
    for b in buildings:
        b_kwh = (
            db.query(EnergyReading.energy_kwh)
            .filter(EnergyReading.building_id == b.id)
            .order_by(EnergyReading.timestamp.desc())
            .limit(days * 24)
            .all()
        )
        sum_kwh = sum(r[0] for r in b_kwh) if b_kwh else 0.0
        emiss = round(sum_kwh * factor, 2)
        bld_emissions.append(
            {
                "building_id": b.id,
                "building_name": b.name,
                "building_type": b.building_type,
                "total_kwh": round(sum_kwh, 1),
                "emissions_kg_co2e": emiss,
                "intensity_kg_per_sqm": round(emiss / b.floor_area_sqm, 2) if b.floor_area_sqm else None,
            }
        )

    return {
        "emissions_factor_kg_per_kwh": factor,
        "factor_source": setting.factor_source,
        "period_days": days,
        "total_energy_kwh": round(total_kwh, 2),
        "total_emissions_kg_co2e": total_emissions,
        "daily_avg_emissions_kg_co2e": daily_avg,
        "forecast_emissions_next_7d_kg_co2e": forecast_emissions_7d,
        "series": series,
        "emissions_by_building": bld_emissions,
        "disclaimer": "All carbon figures are estimates derived from the specified electricity emissions factor; actual grid intensity fluctuates hourly.",
    }
