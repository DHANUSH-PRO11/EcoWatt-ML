import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_forecast_with_explainability_and_calibration():
    payload = {
        "horizon_hours": 24,
        "confidence_level": 0.95,
        "building_id": 1,
    }
    res = client.post("/api/forecast", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["horizon_hours"] == 24
    assert "predictions" in data
    assert len(data["predictions"]) == 24

    first_pred = data["predictions"][0]
    assert "predicted_kwh" in first_pred
    assert "baseline_kwh" in first_pred
    assert "lower_bound_kwh" in first_pred
    assert "upper_bound_kwh" in first_pred
    assert "uncertainty_multiplier" in first_pred
    assert first_pred["uncertainty_multiplier"] >= 1.0

    # Verify explainability features
    assert "top_features" in data
    assert len(data["top_features"]) >= 3
    for feat in data["top_features"]:
        assert "feature" in feat
        assert "importance_pct" in feat
        assert "interpretation" in feat

    # Verify interval calibration coverage
    assert "interval_calibration" in data
    calib = data["interval_calibration"]
    assert calib["is_adequately_calibrated"] is True
    assert calib["empirical_coverage_pct"] >= 88.0

    # Verify disclaimer is present
    assert "explainability_disclaimer" in data
    assert "causality" in data["explainability_disclaimer"].lower() or "statistical" in data["explainability_disclaimer"].lower()


def test_forecast_history():
    res = client.get("/api/forecast/history?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
