import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["online", "healthy"]
    assert "ml_forecaster" in data


def test_dashboard_summary():
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "today_consumption_kwh" in data
    assert "billing_period_consumption_kwh" in data
    assert "estimated_bill" in data
    assert "submetering_breakdown" in data


def test_energy_history():
    response = client.get("/api/energy/history?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "readings" in data
    assert len(data["readings"]) <= 10


def test_energy_analytics():
    response = client.get("/api/energy/analytics?aggregation=daily")
    assert response.status_code == 200
    data = response.json()
    assert data["aggregation"] == "daily"
    assert "series" in data
    assert len(data["series"]) > 0


def test_bill_estimate():
    payload = {
        "total_kwh": 350.0,
        "billing_period_days": 30,
    }
    response = client.post("/api/bills/estimate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_kwh"] == 350.0
    assert data["total_estimated_bill"] > 0
    assert len(data["slab_breakdown"]) > 0


def test_insights():
    response = client.get("/api/insights")
    assert response.status_code == 200
    data = response.json()
    assert "insights" in data
    assert "baseload_analysis" in data
    assert "peak_hours_analysis" in data


def test_anomalies_list():
    response = client.get("/api/anomalies?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "new_count" in data


def test_tariff_get_and_put():
    # GET tariff
    res = client.get("/api/settings/tariff")
    assert res.status_code == 200
    orig = res.json()
    assert "slabs" in orig

    # PUT update
    update_payload = {
        "fixed_charge": 16.50,
    }
    res_put = client.put("/api/settings/tariff", json=update_payload)
    assert res_put.status_code == 200
    assert res_put.json()["fixed_charge"] == 16.50

    # Restore
    client.put("/api/settings/tariff", json={"fixed_charge": orig["fixed_charge"]})
