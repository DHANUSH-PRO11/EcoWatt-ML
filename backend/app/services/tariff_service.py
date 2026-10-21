import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from backend.app.models.tariff import TariffSetting
from backend.app.schemas.tariff import TariffSettingUpdate, TariffSlab, TariffSettingResponse

DEFAULT_SLABS = [
    {"tier": 1, "max_kwh": 100.0, "rate": 0.11},
    {"tier": 2, "max_kwh": 300.0, "rate": 0.15},
    {"tier": 3, "max_kwh": 500.0, "rate": 0.20},
    {"tier": 4, "max_kwh": None, "rate": 0.26},
]


def get_or_create_active_tariff(db: Session) -> TariffSetting:
    """Retrieve active tariff setting or seed default tiered tariff."""
    tariff = db.query(TariffSetting).filter(TariffSetting.is_active == True).first()
    if not tariff:
        tariff = TariffSetting(
            name="Standard Residential Tiered Tariff",
            currency="USD",
            currency_symbol="$",
            tariff_type="tiered",
            fixed_charge=15.00,
            tax_rate_pct=7.0,
            surcharge_pct=3.0,
            slabs_json=json.dumps(DEFAULT_SLABS),
            is_active=True,
        )
        db.add(tariff)
        db.commit()
        db.refresh(tariff)
    return tariff


def update_active_tariff(db: Session, update_data: TariffSettingUpdate) -> TariffSetting:
    """Update settings on active tariff."""
    tariff = get_or_create_active_tariff(db)

    if update_data.name is not None:
        tariff.name = update_data.name
    if update_data.currency is not None:
        tariff.currency = update_data.currency
    if update_data.currency_symbol is not None:
        tariff.currency_symbol = update_data.currency_symbol
    if update_data.tariff_type is not None:
        tariff.tariff_type = update_data.tariff_type
    if update_data.fixed_charge is not None:
        tariff.fixed_charge = update_data.fixed_charge
    if update_data.tax_rate_pct is not None:
        tariff.tax_rate_pct = update_data.tax_rate_pct
    if update_data.surcharge_pct is not None:
        tariff.surcharge_pct = update_data.surcharge_pct
    if update_data.slabs is not None:
        slabs_dicts = [slab.model_dump() for slab in update_data.slabs]
        # Sort slabs by tier
        slabs_dicts.sort(key=lambda x: x["tier"])
        tariff.slabs_json = json.dumps(slabs_dicts)

    tariff.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(tariff)
    return tariff


def serialize_tariff_response(tariff: TariffSetting) -> TariffSettingResponse:
    slabs_raw = json.loads(tariff.slabs_json)
    slabs = [TariffSlab(**s) for s in slabs_raw]
    return TariffSettingResponse(
        id=tariff.id,
        name=tariff.name,
        currency=tariff.currency,
        currency_symbol=tariff.currency_symbol,
        tariff_type=tariff.tariff_type,
        fixed_charge=tariff.fixed_charge,
        tax_rate_pct=tariff.tax_rate_pct,
        surcharge_pct=tariff.surcharge_pct,
        slabs=slabs,
        is_active=tariff.is_active,
        updated_at=tariff.updated_at.isoformat() if tariff.updated_at else datetime.now(timezone.utc).isoformat(),
    )
