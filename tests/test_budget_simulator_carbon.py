import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_budget_status_and_settings():
    # 1. Fetch budget settings
    res_settings = client.get("/api/budget/settings")
    assert res_settings.status_code == 200
    settings = res_settings.json()
    assert "monthly_budget_amount" in settings

    # 2. Update budget
    update_res = client.put(
        "/api/budget/settings",
        json={"monthly_budget_amount": 175.0, "monthly_kwh_target": 550.0},
    )
    assert update_res.status_code == 200
    assert update_res.json()["monthly_budget_amount"] == 175.0

    # 3. Fetch budget forecast status
    res_status = client.get("/api/budget/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert "measured_mtd_kwh" in status_data
    assert "forecast_remaining_kwh" in status_data
    assert "projected_total_cost" in status_data
    assert "currency_symbol" in status_data


def test_what_if_simulator():
    payload = {
        "reduction_pct": 15.0,
        "shift_peak_to_offpeak_pct": 20.0,
        "weekend_reduction_pct": 10.0,
        "billing_period_days": 30,
    }
    res = client.post("/api/simulator/run", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["baseline_kwh"] > 0
    assert data["simulated_kwh"] < data["baseline_kwh"]
    assert data["kwh_saved"] > 0
    assert data["monthly_savings"] >= 0
    assert data["annual_projected_savings"] == round(data["monthly_savings"] * 12.0, 2)
    assert "hourly_comparison" in data
    assert len(data["hourly_comparison"]) == 24
    assert "assumptions_and_limitations" in data


def test_carbon_analytics():
    # 1. Fetch analytics
    res = client.get("/api/carbon/analytics?days=14")
    assert res.status_code == 200
    data = res.json()
    assert "emissions_factor_kg_per_kwh" in data
    assert "total_emissions_kg_co2e" in data
    assert "series" in data
    assert "emissions_by_building" in data

    # 2. Update emissions factor
    update_res = client.put(
        "/api/carbon/settings",
        json={
            "emissions_factor_kg_per_kwh": 0.412,
            "factor_source": "Regional ISO-NE Grid Intensity (2025)",
        },
    )
    assert update_res.status_code == 200
    assert update_res.json()["emissions_factor_kg_per_kwh"] == 0.412


def test_circuit_analytics():
    res = client.get("/api/circuits/analytics?days=14")
    assert res.status_code == 200
    data = res.json()
    assert "circuits" in data
    assert len(data["circuits"]) == 4
    for c in data["circuits"]:
        assert "appliances_covered" in c
        assert "share_pct" in c
        assert "measurement_status" in c
