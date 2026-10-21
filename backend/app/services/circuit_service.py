from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from backend.app.models.energy import EnergyReading


def get_circuit_analytics(
    db: Session,
    building_id: Optional[int] = None,
    days: int = 30,
) -> Dict[str, Any]:
    """
    Computes rigorous circuit-level telemetry analysis:
    - Contribution to total measured consumption
    - Peak load hour and maximum draw for each circuit
    - Weekday vs weekend utilization
    - Identification of measured vs simulated circuits
    """
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(days * 24).all()
    if not readings:
        return {
            "circuits": [],
            "total_measured_kwh": 0.0,
            "period_days": days,
            "is_simulated": True,
        }

    readings = list(reversed(readings))
    is_sim = bool(readings[-1].is_simulated)

    df = pd.DataFrame(
        [
            {
                "timestamp": r.timestamp,
                "total": r.energy_kwh,
                "sub_1": r.sub_metering_1_kwh or 0.0,
                "sub_2": r.sub_metering_2_kwh or 0.0,
                "sub_3": r.sub_metering_3_kwh or 0.0,
                "sub_other": r.sub_metering_other_kwh or 0.0,
            }
            for r in readings
        ]
    )

    df["hour"] = df["timestamp"].dt.hour
    df["is_weekend"] = df["timestamp"].dt.dayofweek >= 5

    total_kwh = float(df["total"].sum())
    sub1_kwh = float(df["sub_1"].sum())
    sub2_kwh = float(df["sub_2"].sum())
    sub3_kwh = float(df["sub_3"].sum())
    sub_other_kwh = float(df["sub_other"].sum())

    # Circuit metadata definition
    circuit_defs = [
        {
            "id": "sub_1",
            "name": "Kitchen & Cooking Sub-Panel",
            "appliances_covered": "Dishwasher, Microwave, Electric Oven, Kitchen Outlets",
            "total_kwh": round(sub1_kwh, 2),
            "share_pct": round((sub1_kwh / max(total_kwh, 0.01)) * 100, 1),
            "peak_kwh": round(float(df["sub_1"].max()), 3),
            "peak_hour": int(df.groupby("hour")["sub_1"].mean().idxmax()),
            "weekday_avg": round(float(df[~df["is_weekend"]]["sub_1"].mean()), 3),
            "weekend_avg": round(float(df[df["is_weekend"]]["sub_1"].mean()), 3),
            "measurement_status": "Simulated Benchmark" if is_sim else "Physically Measured (Submeter 1)",
        },
        {
            "id": "sub_2",
            "name": "Laundry & Utility Sub-Panel",
            "appliances_covered": "Washing Machine, Tumble Dryer, Utility Outlets",
            "total_kwh": round(sub2_kwh, 2),
            "share_pct": round((sub2_kwh / max(total_kwh, 0.01)) * 100, 1),
            "peak_kwh": round(float(df["sub_2"].max()), 3),
            "peak_hour": int(df.groupby("hour")["sub_2"].mean().idxmax()),
            "weekday_avg": round(float(df[~df["is_weekend"]]["sub_2"].mean()), 3),
            "weekend_avg": round(float(df[df["is_weekend"]]["sub_2"].mean()), 3),
            "measurement_status": "Simulated Benchmark" if is_sim else "Physically Measured (Submeter 2)",
        },
        {
            "id": "sub_3",
            "name": "Climate & Thermal Heating Sub-Panel",
            "appliances_covered": "Electric Water Heater, Air Conditioner, Heat Pump",
            "total_kwh": round(sub3_kwh, 2),
            "share_pct": round((sub3_kwh / max(total_kwh, 0.01)) * 100, 1),
            "peak_kwh": round(float(df["sub_3"].max()), 3),
            "peak_hour": int(df.groupby("hour")["sub_3"].mean().idxmax()),
            "weekday_avg": round(float(df[~df["is_weekend"]]["sub_3"].mean()), 3),
            "weekend_avg": round(float(df[df["is_weekend"]]["sub_3"].mean()), 3),
            "measurement_status": "Simulated Benchmark" if is_sim else "Physically Measured (Submeter 3)",
        },
        {
            "id": "sub_other",
            "name": "Remaining Household Circuits",
            "appliances_covered": "Lighting, Entertainment, Refrigeration, Standby Outlets",
            "total_kwh": round(sub_other_kwh, 2),
            "share_pct": round((sub_other_kwh / max(total_kwh, 0.01)) * 100, 1),
            "peak_kwh": round(float(df["sub_other"].max()), 3),
            "peak_hour": int(df.groupby("hour")["sub_other"].mean().idxmax()),
            "weekday_avg": round(float(df[~df["is_weekend"]]["sub_other"].mean()), 3),
            "weekend_avg": round(float(df[df["is_weekend"]]["sub_other"].mean()), 3),
            "measurement_status": "Computed Difference (Total - Monitored Submeters)",
        },
    ]

    # Daily resampled trend for multi-circuit line chart
    df_daily = df.set_index("timestamp").resample("1D").sum()
    daily_trend = [
        {
            "date": dt.strftime("%Y-%m-%d"),
            "total_kwh": round(float(r["total"]), 2),
            "kitchen_kwh": round(float(r["sub_1"]), 2),
            "laundry_kwh": round(float(r["sub_2"]), 2),
            "climate_kwh": round(float(r["sub_3"]), 2),
            "other_kwh": round(float(r["sub_other"]), 2),
        }
        for dt, r in df_daily.iterrows()
    ]

    return {
        "period_days": days,
        "total_measured_kwh": round(total_kwh, 2),
        "is_simulated": is_sim,
        "circuits": circuit_defs,
        "daily_trend": daily_trend,
        "disclaimer": (
            "Circuit allocations are based directly on submeter channel telemetry. "
            "Individual appliance disaggregation from aggregate circuits is not inferred without direct branch sensor data."
        ),
    }
