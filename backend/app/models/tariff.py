from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
from backend.app.database import Base


class TariffSetting(Base):
    __tablename__ = "tariff_settings"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), default="Standard Residential Tiered Tariff", nullable=False)
    currency = Column(String(8), default="USD", nullable=False)
    currency_symbol = Column(String(8), default="$", nullable=False)
    tariff_type = Column(String(32), default="tiered", nullable=False)  # 'tiered', 'flat', 'tou'
    fixed_charge = Column(Float, default=15.00, nullable=False)
    tax_rate_pct = Column(Float, default=7.0, nullable=False)  # Percentage, e.g. 7.0 for 7%
    surcharge_pct = Column(Float, default=3.0, nullable=False)  # Percentage, e.g. 3.0 for 3%
    # JSON array storing slabs: [{"max_kwh": 100, "rate": 0.12}, {"max_kwh": 300, "rate": 0.16}, {"max_kwh": null, "rate": 0.22}]
    slabs_json = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
