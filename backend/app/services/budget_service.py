import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.models.budget import BudgetSetting
from backend.app.models.energy import EnergyReading
from backend.app.models.tariff import TariffSetting
from backend.app.models.notification import Notification
from backend.app.services.tariff_service import get_or_create_active_tariff
from backend.app.services.billing_service import calculate_tiered_energy_charge, estimate_bill
from backend.app.schemas.billing import BillEstimateRequest
from backend.app.schemas.tariff import TariffSlab
from backend.app.services.forecast_service import generate_forecast
from backend.app.schemas.forecast import ForecastRequest


def get_or_create_budget(db: Session, building_id: Optional[int] = None) -> BudgetSetting:
    budget = db.query(BudgetSetting).filter(BudgetSetting.building_id == building_id).first()
    if not budget:
        # Check global default
        budget = db.query(BudgetSetting).first()
    if not budget:
        budget = BudgetSetting(
            building_id=building_id,
            monthly_budget_amount=160.0,
            monthly_kwh_target=520.0,
            currency="USD",
            alert_thresholds_json="[80, 90, 100]",
            billing_cycle_day=1,
        )
        db.add(budget)
        db.commit()
        db.refresh(budget)
    return budget


def update_budget(
    db: Session,
    building_id: Optional[int] = None,
    monthly_budget_amount: Optional[float] = None,
    monthly_kwh_target: Optional[float] = None,
    billing_cycle_day: Optional[int] = None,
    alert_thresholds: Optional[List[int]] = None,
) -> BudgetSetting:
    budget = get_or_create_budget(db, building_id)
    if monthly_budget_amount is not None:
        budget.monthly_budget_amount = max(1.0, monthly_budget_amount)
    if monthly_kwh_target is not None:
        budget.monthly_kwh_target = max(1.0, monthly_kwh_target)
    if billing_cycle_day is not None:
        budget.billing_cycle_day = min(28, max(1, billing_cycle_day))
    if alert_thresholds is not None:
        budget.alert_thresholds_json = json.dumps(sorted(alert_thresholds))

    db.commit()
    db.refresh(budget)
    return budget


def get_budget_forecast_status(db: Session, building_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Computes Month-to-Date measured consumption & cost, forecasts remaining days in billing period,
    calculates projected bill against budget, and triggers notifications on threshold breaches.
    """
    budget = get_or_create_budget(db, building_id)
    tariff = get_or_create_active_tariff(db)
    currency_symbol = tariff.currency_symbol or "$"
    currency = tariff.currency or "USD"

    # 1. Fetch latest readings to determine billing cycle range
    query = db.query(EnergyReading)
    if building_id:
        query = query.filter(EnergyReading.building_id == building_id)

    readings = query.order_by(EnergyReading.timestamp.desc()).limit(1440).all()
    if not readings:
        return {
            "monthly_budget_amount": budget.monthly_budget_amount,
            "monthly_kwh_target": budget.monthly_kwh_target,
            "currency": currency,
            "currency_symbol": currency_symbol,
            "measured_mtd_kwh": 0.0,
            "measured_mtd_cost": 0.0,
            "forecast_remaining_kwh": 0.0,
            "projected_total_kwh": 0.0,
            "projected_total_cost": 0.0,
            "budget_consumed_pct": 0.0,
            "projected_budget_used_pct": 0.0,
            "expected_overspend_amount": 0.0,
            "is_projected_over_budget": False,
            "days_elapsed_in_cycle": 1,
            "days_remaining_in_cycle": 29,
            "active_threshold_alerts": [],
        }

    latest_ts = readings[0].timestamp
    cycle_start = latest_ts.replace(day=budget.billing_cycle_day, hour=0, minute=0, second=0, microsecond=0)
    if latest_ts.day < budget.billing_cycle_day:
        # Billing cycle started last month
        prev_month = latest_ts.month - 1 if latest_ts.month > 1 else 12
        prev_year = latest_ts.year if latest_ts.month > 1 else latest_ts.year - 1
        cycle_start = cycle_start.replace(year=prev_year, month=prev_month)

    days_elapsed = max(1, (latest_ts - cycle_start).days)
    days_in_cycle = 30
    days_remaining = max(0, days_in_cycle - days_elapsed)

    # Measured MTD
    mtd_readings = [r for r in readings if r.timestamp >= cycle_start]
    measured_mtd_kwh = float(sum(r.energy_kwh for r in mtd_readings)) if mtd_readings else 0.0

    # Measured MTD cost
    bill_mtd = estimate_bill(BillEstimateRequest(total_kwh=measured_mtd_kwh, billing_period_days=days_elapsed), db)
    measured_mtd_cost = bill_mtd.total_estimated_bill

    # Forecast remaining days
    daily_avg = measured_mtd_kwh / days_elapsed if days_elapsed > 0 else 15.0
    forecast_remaining_kwh = round(daily_avg * days_remaining, 2)

    projected_total_kwh = round(measured_mtd_kwh + forecast_remaining_kwh, 2)
    projected_bill = estimate_bill(BillEstimateRequest(total_kwh=projected_total_kwh, billing_period_days=30), db)
    projected_total_cost = projected_bill.total_estimated_bill

    consumed_pct = round((measured_mtd_cost / budget.monthly_budget_amount) * 100, 1)
    projected_pct = round((projected_total_cost / budget.monthly_budget_amount) * 100, 1)
    overspend = round(max(0.0, projected_total_cost - budget.monthly_budget_amount), 2)

    # Check alert thresholds
    thresholds = json.loads(budget.alert_thresholds_json)
    active_alerts = []
    for th in thresholds:
        if projected_pct >= th:
            active_alerts.append(th)
            # Create in-app notification if projected to exceed 100% or 90%
            if th == 100 and overspend > 0:
                notif_exists = db.query(Notification).filter(
                    Notification.category == "budget",
                    Notification.severity == "critical",
                    Notification.is_read == False,
                ).first()
                if not notif_exists:
                    db.add(
                        Notification(
                            building_id=building_id,
                            category="budget",
                            severity="critical",
                            title="Budget Overspend Forecasted",
                            message=f"Projected month-end bill ({currency_symbol}{projected_total_cost:.2f}) exceeds budget of {currency_symbol}{budget.monthly_budget_amount:.2f} by {currency_symbol}{overspend:.2f} ({projected_pct}%).",
                            link_url="/billing",
                        )
                    )
                    db.commit()

    return {
        "monthly_budget_amount": budget.monthly_budget_amount,
        "monthly_kwh_target": budget.monthly_kwh_target,
        "currency": currency,
        "currency_symbol": currency_symbol,
        "measured_mtd_kwh": round(measured_mtd_kwh, 2),
        "measured_mtd_cost": round(measured_mtd_cost, 2),
        "forecast_remaining_kwh": forecast_remaining_kwh,
        "projected_total_kwh": projected_total_kwh,
        "projected_total_cost": round(projected_total_cost, 2),
        "budget_consumed_pct": consumed_pct,
        "projected_budget_used_pct": projected_pct,
        "expected_overspend_amount": overspend,
        "is_projected_over_budget": projected_total_cost > budget.monthly_budget_amount,
        "days_elapsed_in_cycle": days_elapsed,
        "days_remaining_in_cycle": days_remaining,
        "active_threshold_alerts": active_alerts,
        "tariff_assumptions": {
            "fixed_charge": tariff.fixed_charge,
            "tax_rate_pct": tariff.tax_rate_pct,
            "surcharge_pct": tariff.surcharge_pct,
            "tier_slabs": json.loads(tariff.slabs_json),
        },
    }
