import json
from datetime import datetime, timezone
from typing import List, Dict, Any
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.models.energy import EnergyReading
from backend.app.schemas.insights import EnergySavingInsight, InsightsResponse
from backend.app.services.tariff_service import get_or_create_active_tariff


def generate_energy_insights(db: Session) -> InsightsResponse:
    """
    Generate evidence-based energy efficiency recommendations derived strictly from
    measured historical consumption patterns and active tariff rates.
    """
    # Load recent 60 days of hourly readings (1440 hours)
    readings = (
        db.query(EnergyReading)
        .order_by(EnergyReading.timestamp.desc())
        .limit(1440)
        .all()
    )

    if not readings:
        now_iso = datetime.now(timezone.utc).isoformat()
        return InsightsResponse(
            generated_at=now_iso,
            total_potential_monthly_savings_kwh=0.0,
            total_potential_monthly_savings_currency=0.0,
            currency="USD",
            currency_symbol="$",
            insights=[],
            baseload_analysis={},
            peak_hours_analysis={},
            weekend_vs_weekday_analysis={},
            hourly_distribution=[],
        )

    readings = list(reversed(readings))
    df = pd.DataFrame(
        [
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
    )

    df["hour"] = df["timestamp"].dt.hour
    df["dayofweek"] = df["timestamp"].dt.dayofweek
    df["is_weekend"] = df["dayofweek"] >= 5

    # Retrieve active tariff to calculate verified monetary savings
    tariff = get_or_create_active_tariff(db)
    slabs = json.loads(tariff.slabs_json)
    # Estimate baseline marginal rate from mid tier
    avg_kwh_rate = slabs[1]["rate"] if len(slabs) > 1 else slabs[0]["rate"]
    currency = tariff.currency
    symbol = tariff.currency_symbol

    insights: List[EnergySavingInsight] = []
    total_savings_kwh = 0.0
    total_savings_currency = 0.0

    # 1. Baseload (01:00 - 05:00) Analysis
    night_mask = (df["hour"] >= 1) & (df["hour"] <= 5)
    night_df = df[night_mask]
    avg_night_kwh = float(night_df["energy_kwh"].mean())
    avg_overall_kwh = float(df["energy_kwh"].mean())
    night_ratio = avg_night_kwh / max(avg_overall_kwh, 0.01)

    baseload_analysis = {
        "avg_overnight_hourly_kwh": round(avg_night_kwh, 3),
        "overall_hourly_kwh": round(avg_overall_kwh, 3),
        "overnight_to_daily_ratio": round(night_ratio, 2),
        "monthly_overnight_kwh": round(avg_night_kwh * 4 * 30, 1),
    }

    if avg_night_kwh > 0.35:
        # Benchmark lean baseload target: 0.22 kWh/h
        reducible_kwh_per_hour = avg_night_kwh - 0.22
        monthly_kwh_save = reducible_kwh_per_hour * 4 * 30  # 4 overnight hours * 30 days
        cost_save = monthly_kwh_save * avg_kwh_rate
        total_savings_kwh += monthly_kwh_save
        total_savings_currency += cost_save

        insights.append(
            EnergySavingInsight(
                id="baseload-reduction",
                title="Mitigate Elevated Overnight Standby Power",
                category="baseload",
                severity="medium" if avg_night_kwh < 0.60 else "high",
                potential_savings_kwh=round(monthly_kwh_save, 1),
                potential_savings_currency=round(cost_save, 2),
                triggering_pattern=(
                    f"Measured overnight consumption between 01:00 and 05:00 averages {round(avg_night_kwh, 2)} kWh/h, "
                    f"accounting for {round(night_ratio * 100, 1)}% of total daily average demand. "
                    f"Over 30 days, overnight idle consumption accumulates to {round(avg_night_kwh * 4 * 30, 1)} kWh."
                ),
                actionable_recommendation=(
                    "Audit always-on devices during sleep hours. Connect entertainment systems, computing accessories, "
                    "and display units to smart power strips that eliminate vampire phantom loads when idle."
                ),
                measured_metrics=baseload_analysis,
            )
        )

    # 2. Peak Hours (18:00 - 21:00) Evening Concentration
    peak_mask = (df["hour"] >= 18) & (df["hour"] <= 21)
    peak_df = df[peak_mask]
    avg_peak_kwh = float(peak_df["energy_kwh"].mean())
    offpeak_day_mask = (df["hour"] >= 9) & (df["hour"] <= 17)
    avg_offpeak_day_kwh = float(df[offpeak_day_mask]["energy_kwh"].mean()) if offpeak_day_mask.any() else avg_overall_kwh

    # Daily peak percentage
    daily_groups = df.groupby(df["timestamp"].dt.date)
    daily_peak_shares = []
    for _, day_data in daily_groups:
        d_peak = day_data[day_data["hour"].between(18, 21)]["energy_kwh"].sum()
        d_total = day_data["energy_kwh"].sum()
        if d_total > 0:
            daily_peak_shares.append((d_peak / d_total) * 100)

    avg_peak_share_pct = float(np.mean(daily_peak_shares)) if daily_peak_shares else 25.0

    peak_analysis = {
        "avg_peak_hourly_kwh": round(avg_peak_kwh, 3),
        "avg_offpeak_day_kwh": round(avg_offpeak_day_kwh, 3),
        "peak_window_share_pct": round(avg_peak_share_pct, 1),
    }

    if avg_peak_kwh > avg_offpeak_day_kwh * 1.35 or avg_peak_share_pct > 26.0:
        # Potential 15% peak load shift
        monthly_peak_kwh = avg_peak_kwh * 4 * 30
        shifted_kwh = monthly_peak_kwh * 0.15
        savings_monetary = shifted_kwh * avg_kwh_rate
        total_savings_kwh += shifted_kwh
        total_savings_currency += savings_monetary

        insights.append(
            EnergySavingInsight(
                id="peak-load-shifting",
                title="Shift Concentrated Evening Peak Usage",
                category="peak_usage",
                severity="medium",
                potential_savings_kwh=round(shifted_kwh, 1),
                potential_savings_currency=round(savings_monetary, 2),
                triggering_pattern=(
                    f"Concentration during evening peak window (18:00–21:00) averages {round(avg_peak_kwh, 2)} kWh/h, "
                    f"which is {round(((avg_peak_kwh / max(avg_offpeak_day_kwh, 0.01)) - 1.0) * 100, 1)}% higher than "
                    f"off-peak daytime average ({round(avg_offpeak_day_kwh, 2)} kWh/h), contributing {round(avg_peak_share_pct, 1)}% "
                    f"of total daily energy."
                ),
                actionable_recommendation=(
                    "Shift heavy discretionary electrical loads (such as dishwasher cycles, laundry washing, and water reheating) "
                    "to off-peak daytime hours or before 17:00 to reduce strain and avoid higher tiered consumption brackets."
                ),
                measured_metrics=peak_analysis,
            )
        )

    # 3. Weekend vs Weekday Consumption
    weekend_days = df[df["is_weekend"]].groupby(df["timestamp"].dt.date)["energy_kwh"].sum()
    weekday_days = df[~df["is_weekend"]].groupby(df["timestamp"].dt.date)["energy_kwh"].sum()

    avg_weekend_daily = float(weekend_days.mean()) if len(weekend_days) > 0 else 0.0
    avg_weekday_daily = float(weekday_days.mean()) if len(weekday_days) > 0 else 0.0
    weekend_diff_pct = (
        ((avg_weekend_daily - avg_weekday_daily) / max(avg_weekday_daily, 0.01)) * 100
        if avg_weekday_daily > 0
        else 0.0
    )

    weekend_analysis = {
        "avg_weekend_daily_kwh": round(avg_weekend_daily, 2),
        "avg_weekday_daily_kwh": round(avg_weekday_daily, 2),
        "weekend_surge_pct": round(weekend_diff_pct, 1),
    }

    if weekend_diff_pct > 15.0:
        excess_kwh = (avg_weekend_daily - avg_weekday_daily) * 8  # ~8 weekend days per month
        potential_reduction = excess_kwh * 0.30  # 30% reduction in excess
        cost_savings = potential_reduction * avg_kwh_rate
        total_savings_kwh += potential_reduction
        total_savings_currency += cost_savings

        insights.append(
            EnergySavingInsight(
                id="weekend-surge-optimization",
                title="Optimize High Weekend Consumption Surge",
                category="weekend",
                severity="low" if weekend_diff_pct < 30.0 else "medium",
                potential_savings_kwh=round(potential_reduction, 1),
                potential_savings_currency=round(cost_savings, 2),
                triggering_pattern=(
                    f"Measured weekend consumption averages {round(avg_weekend_daily, 2)} kWh/day compared to "
                    f"{round(avg_weekday_daily, 2)} kWh/day on weekdays (+{round(weekend_diff_pct, 1)}% increase)."
                ),
                actionable_recommendation=(
                    "Stagger laundry cycles and thermal appliance usage across multiple days rather than running "
                    "multiple high-power loads simultaneously over weekends."
                ),
                measured_metrics=weekend_analysis,
            )
        )

    # 4. Spike Event Mitigation
    spike_threshold = avg_overall_kwh * 2.8
    spikes = df[df["energy_kwh"] > spike_threshold]
    spike_count = len(spikes)

    if spike_count >= 5:
        excess_spike_kwh = float((spikes["energy_kwh"] - spike_threshold).sum())
        savings_currency = excess_spike_kwh * avg_kwh_rate
        total_savings_kwh += excess_spike_kwh
        total_savings_currency += savings_currency

        insights.append(
            EnergySavingInsight(
                id="demand-spike-mitigation",
                title="Prevent Simultaneous High-Draw Appliance Spikes",
                category="anomalous_spikes",
                severity="high" if spike_count > 15 else "medium",
                potential_savings_kwh=round(excess_spike_kwh, 1),
                potential_savings_currency=round(savings_currency, 2),
                triggering_pattern=(
                    f"Recorded {spike_count} high-draw spikes exceeding {round(spike_threshold, 2)} kWh/h in recent history, "
                    f"generating {round(excess_spike_kwh, 1)} kWh of peak surge energy."
                ),
                actionable_recommendation=(
                    "Avoid running high-wattage appliances (e.g. electric oven, clothes dryer, and water heater) concurrently. "
                    "Staggering heavy power consumers lowers demand peaks."
                ),
                measured_metrics={"spike_count": spike_count, "spike_threshold_kwh": round(spike_threshold, 2)},
            )
        )

    # 5. Hourly Distribution Summary (0 to 23)
    hourly_group = df.groupby("hour")["energy_kwh"].agg(["mean", "max", "min"])
    hourly_dist = []
    for h in range(24):
        if h in hourly_group.index:
            row = hourly_group.loc[h]
            hourly_dist.append(
                {
                    "hour": h,
                    "avg_kwh": round(float(row["mean"]), 3),
                    "peak_kwh": round(float(row["max"]), 3),
                    "min_kwh": round(float(row["min"]), 3),
                }
            )
        else:
            hourly_dist.append({"hour": h, "avg_kwh": 0.0, "peak_kwh": 0.0, "min_kwh": 0.0})

    return InsightsResponse(
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_potential_monthly_savings_kwh=round(total_savings_kwh, 1),
        total_potential_monthly_savings_currency=round(total_savings_currency, 2),
        currency=currency,
        currency_symbol=symbol,
        insights=insights,
        baseload_analysis=baseload_analysis,
        peak_hours_analysis=peak_analysis,
        weekend_vs_weekday_analysis=weekend_analysis,
        hourly_distribution=hourly_dist,
    )
