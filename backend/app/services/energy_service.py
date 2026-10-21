from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_

from backend.app.models.energy import EnergyReading
from backend.app.schemas.energy import (
    EnergyReadingItem,
    EnergyHistoryResponse,
    EnergyAnalyticsResponse,
    AnalyticsAggregateItem,
)


def get_energy_history(
    db: Session,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = 500,
) -> EnergyHistoryResponse:
    query = db.query(EnergyReading)

    if start_time:
        query = query.filter(EnergyReading.timestamp >= start_time)
    if end_time:
        query = query.filter(EnergyReading.timestamp <= end_time)

    # Order ascending for time-series visualization
    total_count = query.count()
    readings = query.order_by(EnergyReading.timestamp.desc()).limit(limit).all()
    # Reverse to chronological order
    readings = list(reversed(readings))

    if not readings:
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        return EnergyHistoryResponse(
            total_records=0,
            start_time=now_str,
            end_time=now_str,
            total_kwh=0.0,
            avg_hourly_kwh=0.0,
            peak_hourly_kwh=0.0,
            readings=[],
        )

    items = [
        EnergyReadingItem(
            timestamp=r.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            energy_kwh=round(r.energy_kwh, 3),
            reactive_power_kvar=round(r.reactive_power_kvar, 3) if r.reactive_power_kvar is not None else None,
            voltage=round(r.voltage, 1) if r.voltage is not None else None,
            global_intensity=round(r.global_intensity, 2) if r.global_intensity is not None else None,
            sub_metering_1_kwh=round(r.sub_metering_1_kwh, 3) if r.sub_metering_1_kwh is not None else 0.0,
            sub_metering_2_kwh=round(r.sub_metering_2_kwh, 3) if r.sub_metering_2_kwh is not None else 0.0,
            sub_metering_3_kwh=round(r.sub_metering_3_kwh, 3) if r.sub_metering_3_kwh is not None else 0.0,
            sub_metering_other_kwh=round(r.sub_metering_other_kwh, 3) if r.sub_metering_other_kwh is not None else 0.0,
            is_simulated=r.is_simulated,
        )
        for r in readings
    ]

    energies = [r.energy_kwh for r in readings]
    total_kwh = float(np.sum(energies))
    avg_kwh = float(np.mean(energies))
    peak_kwh = float(np.max(energies))

    return EnergyHistoryResponse(
        total_records=total_count,
        start_time=items[0].timestamp,
        end_time=items[-1].timestamp,
        total_kwh=round(total_kwh, 2),
        avg_hourly_kwh=round(avg_kwh, 3),
        peak_hourly_kwh=round(peak_kwh, 3),
        readings=items,
    )


def get_energy_analytics(
    db: Session,
    aggregation: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> EnergyAnalyticsResponse:
    query = db.query(EnergyReading)

    if start_date:
        query = query.filter(EnergyReading.timestamp >= pd.to_datetime(start_date))
    if end_date:
        # Include through end of day
        query = query.filter(EnergyReading.timestamp <= pd.to_datetime(end_date) + pd.Timedelta(days=1))

    readings = query.order_by(EnergyReading.timestamp.asc()).all()

    if not readings:
        return EnergyAnalyticsResponse(
            aggregation=aggregation,
            start_date=start_date or "",
            end_date=end_date or "",
            total_kwh=0.0,
            average_kwh=0.0,
            peak_kwh=0.0,
            min_kwh=0.0,
            total_sub_1_kwh=0.0,
            total_sub_2_kwh=0.0,
            total_sub_3_kwh=0.0,
            total_sub_other_kwh=0.0,
            series=[],
        )

    # Convert to pandas DataFrame for clean time resampling
    data = [
        {
            "timestamp": r.timestamp,
            "energy_kwh": r.energy_kwh,
            "sub_1": r.sub_metering_1_kwh or 0.0,
            "sub_2": r.sub_metering_2_kwh or 0.0,
            "sub_3": r.sub_metering_3_kwh or 0.0,
            "sub_other": r.sub_metering_other_kwh or 0.0,
        }
        for r in readings
    ]
    df = pd.DataFrame(data).set_index("timestamp")

    if aggregation == "hourly":
        resampled = df.resample("1h").agg(
            {
                "energy_kwh": ["sum", "mean", "max", "min"],
                "sub_1": "sum",
                "sub_2": "sum",
                "sub_3": "sum",
                "sub_other": "sum",
            }
        )
        format_str = "%Y-%m-%d %H:00"
    elif aggregation == "monthly":
        resampled = df.resample("1ME").agg(
            {
                "energy_kwh": ["sum", "mean", "max", "min"],
                "sub_1": "sum",
                "sub_2": "sum",
                "sub_3": "sum",
                "sub_other": "sum",
            }
        )
        format_str = "%Y-%m"
    else:  # Daily default
        resampled = df.resample("1D").agg(
            {
                "energy_kwh": ["sum", "mean", "max", "min"],
                "sub_1": "sum",
                "sub_2": "sum",
                "sub_3": "sum",
                "sub_other": "sum",
            }
        )
        format_str = "%Y-%m-%d"

    series = []
    for dt, row in resampled.iterrows():
        # Skip empty resampled buckets
        if pd.isna(row[("energy_kwh", "sum")]):
            continue
        series.append(
            AnalyticsAggregateItem(
                period=dt.strftime(format_str),
                total_kwh=round(float(row[("energy_kwh", "sum")]), 3),
                avg_kwh=round(float(row[("energy_kwh", "mean")]), 3),
                peak_kwh=round(float(row[("energy_kwh", "max")]), 3),
                min_kwh=round(float(row[("energy_kwh", "min")]), 3),
                sub_1_kwh=round(float(row[("sub_1", "sum")]), 3),
                sub_2_kwh=round(float(row[("sub_2", "sum")]), 3),
                sub_3_kwh=round(float(row[("sub_3", "sum")]), 3),
                sub_other_kwh=round(float(row[("sub_other", "sum")]), 3),
            )
        )

    total_kwh = float(df["energy_kwh"].sum())
    avg_kwh = float(df["energy_kwh"].mean())
    peak_kwh = float(df["energy_kwh"].max())
    min_kwh = float(df["energy_kwh"].min())

    return EnergyAnalyticsResponse(
        aggregation=aggregation,
        start_date=df.index.min().strftime("%Y-%m-%d"),
        end_date=df.index.max().strftime("%Y-%m-%d"),
        total_kwh=round(total_kwh, 2),
        average_kwh=round(avg_kwh, 3),
        peak_kwh=round(peak_kwh, 3),
        min_kwh=round(min_kwh, 3),
        total_sub_1_kwh=round(float(df["sub_1"].sum()), 2),
        total_sub_2_kwh=round(float(df["sub_2"].sum()), 2),
        total_sub_3_kwh=round(float(df["sub_3"].sum()), 2),
        total_sub_other_kwh=round(float(df["sub_other"].sum()), 2),
        series=series,
    )
