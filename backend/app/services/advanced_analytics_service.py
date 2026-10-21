from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.models.energy import EnergyReading
from backend.app.models.building import Building


def get_period_comparisons(db: Session, building_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Computes Day-over-Day, Week-over-Week, Month-over-Month, and Weekday vs Weekend comparisons.
    """
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(1500).all()
    if not readings:
        return {
            "day_over_day": {"current_kwh": 0.0, "previous_kwh": 0.0, "change_pct": 0.0, "change_kwh": 0.0},
            "week_over_week": {"current_kwh": 0.0, "previous_kwh": 0.0, "change_pct": 0.0, "change_kwh": 0.0},
            "month_over_month": {"current_kwh": 0.0, "previous_kwh": 0.0, "change_pct": 0.0, "change_kwh": 0.0},
            "weekday_vs_weekend": {"weekday_avg_hourly_kwh": 0.0, "weekend_avg_hourly_kwh": 0.0, "weekend_diff_pct": 0.0},
        }

    df = pd.DataFrame([{"timestamp": r.timestamp, "energy_kwh": r.energy_kwh} for r in readings])
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("timestamp").reset_index(drop=True)

    max_dt = df["timestamp"].max()

    # Day over Day (last 24 hours vs previous 24 hours)
    d_curr = df[(df["timestamp"] > max_dt - timedelta(hours=24)) & (df["timestamp"] <= max_dt)]["energy_kwh"].sum()
    d_prev = df[(df["timestamp"] > max_dt - timedelta(hours=48)) & (df["timestamp"] <= max_dt - timedelta(hours=24))]["energy_kwh"].sum()
    d_pct = round(((d_curr - d_prev) / max(d_prev, 0.01)) * 100, 1)

    # Week over Week (last 168 hours vs previous 168 hours)
    w_curr = df[(df["timestamp"] > max_dt - timedelta(hours=168)) & (df["timestamp"] <= max_dt)]["energy_kwh"].sum()
    w_prev = df[(df["timestamp"] > max_dt - timedelta(hours=336)) & (df["timestamp"] <= max_dt - timedelta(hours=168))]["energy_kwh"].sum()
    w_pct = round(((w_curr - w_prev) / max(w_prev, 0.01)) * 100, 1) if w_prev > 0 else 0.0

    # Month over Month (last 720 hours vs previous 720 hours)
    m_curr = df[(df["timestamp"] > max_dt - timedelta(hours=720)) & (df["timestamp"] <= max_dt)]["energy_kwh"].sum()
    m_prev = df[(df["timestamp"] > max_dt - timedelta(hours=1440)) & (df["timestamp"] <= max_dt - timedelta(hours=720))]["energy_kwh"].sum()
    m_pct = round(((m_curr - m_prev) / max(m_prev, 0.01)) * 100, 1) if m_prev > 0 else 0.0

    # Weekday vs Weekend
    df["is_weekend"] = df["timestamp"].dt.dayofweek >= 5
    weekday_mean = float(df[~df["is_weekend"]]["energy_kwh"].mean()) if not df[~df["is_weekend"]].empty else 0.0
    weekend_mean = float(df[df["is_weekend"]]["energy_kwh"].mean()) if not df[df["is_weekend"]].empty else 0.0
    we_pct = round(((weekend_mean - weekday_mean) / max(weekday_mean, 0.01)) * 100, 1)

    return {
        "day_over_day": {
            "current_kwh": round(float(d_curr), 2),
            "previous_kwh": round(float(d_prev), 2),
            "change_pct": d_pct,
            "change_kwh": round(float(d_curr - d_prev), 2),
        },
        "week_over_week": {
            "current_kwh": round(float(w_curr), 2),
            "previous_kwh": round(float(w_prev), 2),
            "change_pct": w_pct,
            "change_kwh": round(float(w_curr - w_prev), 2),
        },
        "month_over_month": {
            "current_kwh": round(float(m_curr), 2),
            "previous_kwh": round(float(m_prev), 2),
            "change_pct": m_pct,
            "change_kwh": round(float(m_curr - m_prev), 2),
        },
        "weekday_vs_weekend": {
            "weekday_avg_hourly_kwh": round(weekday_mean, 3),
            "weekend_avg_hourly_kwh": round(weekend_mean, 3),
            "weekend_diff_pct": we_pct,
        },
    }


def get_consumption_heatmap(db: Session, building_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Constructs a 7-day x 24-hour heatmap matrix of mean consumption.
    Day 0 = Monday, Day 6 = Sunday.
    """
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(2000).all()
    if not readings:
        return {"days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], "matrix": []}

    df = pd.DataFrame([{"timestamp": r.timestamp, "energy_kwh": r.energy_kwh} for r in readings])
    df["dow"] = df["timestamp"].dt.dayofweek
    df["hour"] = df["timestamp"].dt.hour

    grouped = df.groupby(["dow", "hour"])["energy_kwh"].mean().unstack(fill_value=0.0)

    day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    matrix = []
    for dow in range(7):
        row = []
        for hour in range(24):
            val = grouped.loc[dow, hour] if dow in grouped.index and hour in grouped.columns else 0.0
            row.append(round(float(val), 3))
        matrix.append({"day": day_names[dow], "dow": dow, "hourly_values": row})

    # Overall peak and baseload slots
    flat_means = df.groupby("hour")["energy_kwh"].mean()
    peak_hour = int(flat_means.idxmax()) if not flat_means.empty else 19
    baseload_hour = int(flat_means.idxmin()) if not flat_means.empty else 3

    return {
        "days": day_names,
        "matrix": matrix,
        "peak_hour": peak_hour,
        "peak_hour_avg_kwh": round(float(flat_means.max()), 3) if not flat_means.empty else 0.0,
        "lowest_hour": baseload_hour,
        "lowest_hour_avg_kwh": round(float(flat_means.min()), 3) if not flat_means.empty else 0.0,
    }


def get_baseload_and_peak_analysis(db: Session, building_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Evaluates overnight baseload (01:00 to 05:00) vs evening peak load (18:00 to 21:00).
    """
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(1000).all()
    if not readings:
        return {
            "avg_baseload_kwh": 0.0,
            "avg_peak_kwh": 0.0,
            "baseload_to_peak_ratio": 0.0,
            "estimated_monthly_vampire_kwh": 0.0,
        }

    df = pd.DataFrame([{"timestamp": r.timestamp, "energy_kwh": r.energy_kwh} for r in readings])
    df["hour"] = df["timestamp"].dt.hour

    baseload_df = df[df["hour"].isin([1, 2, 3, 4])]
    peak_df = df[df["hour"].isin([18, 19, 20, 21])]

    avg_base = float(baseload_df["energy_kwh"].mean()) if not baseload_df.empty else 0.2
    avg_peak = float(peak_df["energy_kwh"].mean()) if not peak_df.empty else 1.0

    ratio = round(avg_base / max(avg_peak, 0.01), 2)
    # Vampire estimate: baseload running 24h/day over 30 days
    monthly_vampire = round(avg_base * 24 * 30, 1)

    return {
        "avg_baseload_kwh": round(avg_base, 3),
        "avg_peak_kwh": round(avg_peak, 3),
        "baseload_to_peak_ratio": ratio,
        "estimated_monthly_vampire_kwh": monthly_vampire,
    }
