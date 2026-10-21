import pytest
from backend.app.schemas.tariff import TariffSlab
from backend.app.services.billing_service import calculate_tiered_energy_charge

DEFAULT_TEST_SLABS = [
    TariffSlab(tier=1, max_kwh=100.0, rate=0.10),
    TariffSlab(tier=2, max_kwh=300.0, rate=0.15),
    TariffSlab(tier=3, max_kwh=500.0, rate=0.20),
    TariffSlab(tier=4, max_kwh=None, rate=0.25),
]


def test_zero_consumption_bill():
    energy_charge, breakdown = calculate_tiered_energy_charge(0.0, DEFAULT_TEST_SLABS)
    assert energy_charge == 0.0
    assert len(breakdown) == 4
    for item in breakdown:
        assert item.kwh_in_slab == 0.0
        assert item.slab_cost == 0.0


def test_tier_1_boundary():
    # Exactly 100 kWh -> 100 * 0.10 = 10.0
    energy_charge, breakdown = calculate_tiered_energy_charge(100.0, DEFAULT_TEST_SLABS)
    assert energy_charge == 10.0
    assert breakdown[0].kwh_in_slab == 100.0
    assert breakdown[0].slab_cost == 10.0
    assert breakdown[1].kwh_in_slab == 0.0


def test_tier_2_consumption():
    # 250 kWh: 100 @ 0.10 ($10) + 150 @ 0.15 ($22.50) = $32.50
    energy_charge, breakdown = calculate_tiered_energy_charge(250.0, DEFAULT_TEST_SLABS)
    assert pytest.approx(energy_charge, 0.01) == 32.50
    assert breakdown[0].kwh_in_slab == 100.0
    assert breakdown[1].kwh_in_slab == 150.0
    assert breakdown[2].kwh_in_slab == 0.0


def test_tier_3_boundary():
    # Exactly 500 kWh: 100 @ 0.10 ($10) + 200 @ 0.15 ($30) + 200 @ 0.20 ($40) = $80.00
    energy_charge, breakdown = calculate_tiered_energy_charge(500.0, DEFAULT_TEST_SLABS)
    assert pytest.approx(energy_charge, 0.01) == 80.00
    assert breakdown[0].kwh_in_slab == 100.0
    assert breakdown[1].kwh_in_slab == 200.0
    assert breakdown[2].kwh_in_slab == 200.0
    assert breakdown[3].kwh_in_slab == 0.0


def test_unbounded_top_tier():
    # 700 kWh: 100 @ 0.10 ($10) + 200 @ 0.15 ($30) + 200 @ 0.20 ($40) + 200 @ 0.25 ($50) = $130.00
    energy_charge, breakdown = calculate_tiered_energy_charge(700.0, DEFAULT_TEST_SLABS)
    assert pytest.approx(energy_charge, 0.01) == 130.00
    assert breakdown[3].kwh_in_slab == 200.0
    assert breakdown[3].slab_cost == 50.0
