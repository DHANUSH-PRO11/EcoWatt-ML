from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class TariffSlab(BaseModel):
    tier: int = Field(..., description="Tier level (1, 2, 3...)")
    max_kwh: Optional[float] = Field(None, description="Upper bound in kWh. None for unlimited top tier.")
    rate: float = Field(..., ge=0.0, description="Cost per kWh in specified currency.")


class TariffSettingBase(BaseModel):
    name: str = "Standard Residential Tiered Tariff"
    currency: str = "USD"
    currency_symbol: str = "$"
    tariff_type: str = "tiered"
    fixed_charge: float = Field(15.0, ge=0.0)
    tax_rate_pct: float = Field(7.0, ge=0.0, le=100.0)
    surcharge_pct: float = Field(3.0, ge=0.0, le=100.0)
    slabs: List[TariffSlab]


class TariffSettingUpdate(BaseModel):
    name: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    tariff_type: Optional[str] = None
    fixed_charge: Optional[float] = Field(None, ge=0.0)
    tax_rate_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    surcharge_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    slabs: Optional[List[TariffSlab]] = None


class TariffSettingResponse(TariffSettingBase):
    id: int
    is_active: bool
    updated_at: str
    model_config = ConfigDict(from_attributes=True)
