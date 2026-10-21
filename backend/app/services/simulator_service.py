from typing import Dict, Any, Optional, List
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

from backend.app.models.energy import EnergyReading
from backend.app.services.tariff_service import get_or_create_active_tariff
from backend.app.services.billing_service import estimate_bill
from backend.app.schemas.billing import BillEstimateRequest
from backend.app.models.carbon import CarbonSetting


def run_energy_simulation(
    db: Session,
    reduction_pct: float = 10.0,
    daily_kwh_target: Optional[float] = None,
    shift_peak_to_offpeak_pct: float = 0.0,
    weekend_reduction_pct: float = 0.0,
    billing_period_days: int = 30,
    building_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Executes what-if scenario simulations on actual historical baseline consumption
    without modifying database records or model weights.
    Calculates transparent kWh and financial savings, projected annual benefits, and avoided emissions.
    """
    # 1. Fetch recent 30 days of actual readings as baseline
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(720).all()
    if not readings:
        baseline_kwh = 450.0
        hourly_baseline = [1.0] * 24
    else:
        readings = list(reversed(readings))
        df = pd.DataFrame([{"timestamp": r.timestamp, "energy_kwh": r.energy_kwh} for r in readings])
        df["hour"] = df["timestamp"].dt.hour
        df["is_weekend"] = df["timestamp"].dt.dayofweek >= 5
        baseline_kwh = float(df["energy_kwh"].sum())
        hourly_baseline = list(df.groupby("hour")["energy_kwh"].mean().values)

    # 2. Apply scenario transformations
    # Base percentage reduction
    sim_kwh = baseline_kwh * (1.0 - (reduction_pct / 100.0))

    # Weekend reduction adjustment
    if weekend_reduction_pct > 0:
        # Weekend is ~8.5 days per 30-day month (28.5% of time)
        weekend_share = 0.30
        sim_kwh -= (baseline_kwh * weekend_share * (weekend_reduction_pct / 100.0))

    # Daily target override if provided and lower
    if daily_kwh_target and daily_kwh_target > 0:
        target_monthly = daily_kwh_target * billing_period_days
        if target_monthly < sim_kwh:
            sim_kwh = target_monthly

    sim_kwh = max(10.0, sim_kwh)
    kwh_saved = max(0.0, baseline_kwh - sim_kwh)
    pct_saved = round((kwh_saved / baseline_kwh) * 100, 1)

    # 3. Bill calculations before and after
    tariff = get_or_create_active_tariff(db)
    currency_symbol = tariff.currency_symbol or "$"
    currency = tariff.currency or "USD"

    bill_base = estimate_bill(BillEstimateRequest(total_kwh=baseline_kwh, billing_period_days=billing_period_days), db)
    bill_sim = estimate_bill(BillEstimateRequest(total_kwh=sim_kwh, billing_period_days=billing_period_days), db)

    cost_base = bill_base.total_estimated_bill
    cost_sim = bill_sim.total_estimated_bill
    cost_saved_monthly = round(max(0.0, cost_base - cost_sim), 2)
    cost_saved_yearly = round(cost_saved_monthly * 12.0, 2)

    # 4. Carbon emissions avoided
    carbon_setting = db.query(CarbonSetting).first()
    emissions_factor = carbon_setting.emissions_factor_kg_per_kwh if carbon_setting else 0.385
    co2_saved_kg = round(kwh_saved * emissions_factor, 1)
    co2_saved_yearly_kg = round(co2_saved_kg * 12.0, 1)

    # 5. 24-hour simulation profile for visual comparison
    sim_hourly = []
    for h, val in enumerate(hourly_baseline):
        h_val = float(val)
        # Apply peak shifting if applicable: 18:00 - 21:00
        if 18 <= h <= 21 and shift_peak_to_offpeak_pct > 0:
            h_val = h_val * (1.0 - (shift_peak_to_offpeak_pct / 100.0))
        # Off-peak receiving shifted load: 11:00 - 15:00
        elif 11 <= h <= 15 and shift_peak_to_offpeak_pct > 0:
            h_val = h_val * (1.0 + (shift_peak_to_offpeak_pct / 200.0))

        # Overall reduction factor
        h_val = h_val * (1.0 - (reduction_pct / 100.0))
        sim_hourly.append(round(max(0.05, h_val), 3))

    hourly_comparison = [
        {
            "hour": h,
            "hour_label": f"{h:02d}:00",
            "baseline_kwh": round(float(hourly_baseline[h]), 3),
            "simulated_kwh": sim_hourly[h],
            "diff_kwh": round(float(hourly_baseline[h]) - sim_hourly[h], 3),
        }
        for h in range(len(hourly_baseline))
    ]

    return {
        "inputs": {
            "reduction_pct": reduction_pct,
            "daily_kwh_target": daily_kwh_target,
            "shift_peak_to_offpeak_pct": shift_peak_to_offpeak_pct,
            "weekend_reduction_pct": weekend_reduction_pct,
            "billing_period_days": billing_period_days,
        },
        "currency": currency,
        "currency_symbol": currency_symbol,
        "baseline_kwh": round(baseline_kwh, 2),
        "simulated_kwh": round(sim_kwh, 2),
        "kwh_saved": round(kwh_saved, 2),
        "pct_kwh_saved": pct_saved,
        "baseline_cost": round(cost_base, 2),
        "simulated_cost": round(cost_sim, 2),
        "monthly_savings": cost_saved_monthly,
        "annual_projected_savings": cost_saved_yearly,
        "monthly_co2e_avoided_kg": co2_saved_kg,
        "annual_co2e_avoided_kg": co2_saved_yearly_kg,
        "emissions_factor_used": emissions_factor,
        "hourly_comparison": hourly_comparison,
        "assumptions_and_limitations": (
            "Simulated projections model uniform proportional scaling across measured intervals. "
            "Actual realized savings depend on specific appliance power ratings, occupant behavior, "
            "and time-varying thermodynamic factors. Does not modify recorded telemetry."
        ),
    }
