import json
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from backend.app.schemas.billing import BillEstimateRequest, BillEstimateResponse, SlabBreakdownItem
from backend.app.schemas.tariff import TariffSlab, TariffSettingUpdate
from backend.app.services.tariff_service import get_or_create_active_tariff


def calculate_tiered_energy_charge(
    total_kwh: float,
    slabs: List[TariffSlab],
) -> Tuple[float, List[SlabBreakdownItem]]:
    """
    Rigorously compute tiered electricity charges across incremental consumption brackets.
    Handles exact boundaries, 0 kWh consumption, and unbounded upper brackets.
    """
    if total_kwh <= 0.0:
        breakdown = []
        for slab in sorted(slabs, key=lambda s: s.tier):
            prev_bound = 0.0 if slab.tier == 1 else (sorted(slabs, key=lambda s: s.tier)[slab.tier - 2].max_kwh or 0.0)
            label = f"{int(prev_bound)} - {int(slab.max_kwh)} kWh" if slab.max_kwh else f"> {int(prev_bound)} kWh"
            breakdown.append(
                SlabBreakdownItem(
                    tier=slab.tier,
                    range_label=label,
                    kwh_in_slab=0.0,
                    rate_per_kwh=slab.rate,
                    slab_cost=0.0,
                )
            )
        return 0.0, breakdown

    sorted_slabs = sorted(slabs, key=lambda s: s.tier)
    breakdown = []
    total_energy_charge = 0.0
    previous_boundary = 0.0

    for slab in sorted_slabs:
        if slab.max_kwh is not None:
            tier_capacity = max(0.0, slab.max_kwh - previous_boundary)
            kwh_in_slab = max(0.0, min(total_kwh - previous_boundary, tier_capacity))
            label = f"{int(previous_boundary)} - {int(slab.max_kwh)} kWh"
            previous_boundary = slab.max_kwh
        else:
            # Unbounded top tier
            kwh_in_slab = max(0.0, total_kwh - previous_boundary)
            label = f"> {int(previous_boundary)} kWh"

        cost = kwh_in_slab * slab.rate
        total_energy_charge += cost

        breakdown.append(
            SlabBreakdownItem(
                tier=slab.tier,
                range_label=label,
                kwh_in_slab=round(kwh_in_slab, 2),
                rate_per_kwh=slab.rate,
                slab_cost=round(cost, 2),
            )
        )

    return total_energy_charge, breakdown


def estimate_bill(
    request: BillEstimateRequest,
    db: Session,
) -> BillEstimateResponse:
    """
    Compute total estimated bill incorporating tiered energy charges, fixed monthly meter fees,
    local tax rates, and grid adjustment surcharges.
    """
    # 1. Resolve tariff (custom override or active database setting)
    active_tariff = get_or_create_active_tariff(db)

    currency = active_tariff.currency
    currency_symbol = active_tariff.currency_symbol
    fixed_charge_base = active_tariff.fixed_charge
    tax_rate_pct = active_tariff.tax_rate_pct
    surcharge_pct = active_tariff.surcharge_pct
    slabs = [TariffSlab(**s) for s in json.loads(active_tariff.slabs_json)]

    # Apply overrides if provided in request
    if request.custom_tariff:
        override = request.custom_tariff
        if override.currency:
            currency = override.currency
        if override.currency_symbol:
            currency_symbol = override.currency_symbol
        if override.fixed_charge is not None:
            fixed_charge_base = override.fixed_charge
        if override.tax_rate_pct is not None:
            tax_rate_pct = override.tax_rate_pct
        if override.surcharge_pct is not None:
            surcharge_pct = override.surcharge_pct
        if override.slabs is not None:
            slabs = override.slabs

    # 2. Compute energy charge
    energy_charge, slab_breakdown = calculate_tiered_energy_charge(request.total_kwh, slabs)

    # 3. Pro-rate fixed charge to billing period days (base is monthly = 30 days)
    pro_rated_fixed_charge = fixed_charge_base * (request.billing_period_days / 30.0)

    # 4. Calculate taxes and grid surcharge
    tax_amount = energy_charge * (tax_rate_pct / 100.0)
    surcharge_amount = energy_charge * (surcharge_pct / 100.0)

    # 5. Grand total
    grand_total = energy_charge + pro_rated_fixed_charge + tax_amount + surcharge_amount
    effective_rate = grand_total / request.total_kwh if request.total_kwh > 0 else 0.0

    return BillEstimateResponse(
        billing_period_days=request.billing_period_days,
        total_kwh=round(request.total_kwh, 2),
        currency=currency,
        currency_symbol=currency_symbol,
        energy_charge=round(energy_charge, 2),
        fixed_charge=round(pro_rated_fixed_charge, 2),
        tax_amount=round(tax_amount, 2),
        surcharge_amount=round(surcharge_amount, 2),
        total_estimated_bill=round(grand_total, 2),
        effective_rate_per_kwh=round(effective_rate, 4),
        slab_breakdown=slab_breakdown,
        disclaimer="This calculation is an estimate for informational purposes and does not represent an official utility billing invoice.",
    )
