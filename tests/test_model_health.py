import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_model_health_and_drift():
    res = client.get("/api/model/health")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert data["status"] in ["Healthy", "Warning", "Drift Detected"]
    assert "drift_score" in data
    assert "recent_rolling_mae" in data
    assert "validation_baseline_mae" in data
    assert "retraining_recommended" in data
    assert "retraining_recommendation_reason" in data


def test_model_training_history():
    res = client.get("/api/model/history?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
