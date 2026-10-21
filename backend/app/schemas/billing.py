from typing import List, Optional
from pydantic import BaseModel, Field
from backend.app.schemas.tariff import TariffSettingUpdate, TariffSlab


class BillEstimateRequest(BaseModel):
    total_kwh: float = Field(..., ge=0.0, description="Total consumption in kWh to estimate bill for.")
    billing_period_days: int = Field(30, ge=1, le=365, description="Number of days in billing cycle.")
    custom_tariff: Optional[TariffSettingUpdate] = Field(None, description="Optional custom tariff override.")


class SlabBreakdownItem(BaseModel):
    tier: int
    range_label: str
    kwh_in_slab: float
    rate_per_kwh: float
    slab_cost: float


class BillEstimateResponse(BaseModel):
    billing_period_days: int
    total_kwh: float
    currency: str
    currency_symbol: str
    energy_charge: float
    fixed_charge: float
    tax_amount: float
    surcharge_amount: float
    total_estimated_bill: float
    effective_rate_per_kwh: float
    slab_breakdown: List[SlabBreakdownItem]
    disclaimer: str = "This calculation is an estimate for informational purposes and does not represent an official utility billing invoice."
