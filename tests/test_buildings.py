import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_list_buildings():
    res = client.get("/api/buildings")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # Check default primary building
    hq = next((b for b in data if b["id"] == 1), None)
    assert hq is not None
    assert "name" in hq
    assert "meters" in hq
    assert len(hq["meters"]) >= 1


def test_portfolio_summary():
    res = client.get("/api/buildings/portfolio/summary")
    assert res.status_code == 200
    data = res.json()
    assert "total_buildings" in data
    assert data["total_buildings"] >= 1
    assert "total_meters" in data
    assert "buildings" in data
    assert len(data["buildings"]) >= 1
    first = data["buildings"][0]
    assert "energy_intensity_kwh_per_sqm" in first
    assert "active_anomalies_count" in first


def test_create_and_update_building():
    # Create building
    payload = {
        "name": "Test Engineering Pavilion",
        "code": "BLD-TEST-99",
        "building_type": "classroom",
        "location": "North Campus Quad",
        "description": "Experimental facility for tests",
        "floor_area_sqm": 500.0,
    }
    create_res = client.post("/api/buildings", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    bld_id = created["id"]
    assert created["code"] == "BLD-TEST-99"

    # Update building
    update_res = client.put(f"/api/buildings/{bld_id}", json={"floor_area_sqm": 550.0})
    assert update_res.status_code == 200
    assert update_res.json()["floor_area_sqm"] == 550.0

    # Register meter
    meter_res = client.post(
        f"/api/buildings/{bld_id}/meters",
        json={
            "meter_code": "MTR-TEST-99-01",
            "name": "Sub-Meter 1",
            "meter_type": "submeter",
            "status": "active",
        },
    )
    assert meter_res.status_code == 201
    assert meter_res.json()["meter_code"] == "MTR-TEST-99-01"

    # Cleanup test building
    del_res = client.delete(f"/api/buildings/{bld_id}")
    assert del_res.status_code == 204
