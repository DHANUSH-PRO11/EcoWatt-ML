import io
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.import_service import validate_csv_dataset, resolve_max_power_threshold
from ml.config import METRICS_FILE

client = TestClient(app)


def test_configurable_power_thresholds_by_building_type():
    """Verify that 15 kW threshold applies to household but commercial facilities allow high industrial draw."""
    # Household threshold resolution
    thresh_house = resolve_max_power_threshold(building_type="household")
    assert thresh_house == 15.0

    # Commercial threshold resolution
    thresh_comm = resolve_max_power_threshold(building_type="commercial")
    assert thresh_comm == 1000.0

    # Laboratory threshold resolution
    thresh_lab = resolve_max_power_threshold(building_type="laboratory")
    assert thresh_lab == 250.0

    # Custom threshold override
    thresh_custom = resolve_max_power_threshold(custom_max_power_threshold=75.0)
    assert thresh_custom == 75.0


def test_import_validation_with_commercial_high_load():
    """Verify that a 45 kW commercial reading is accepted under commercial scope, but rejected under household scope."""
    csv_content = (
        "timestamp,active_power\n"
        "2026-06-01 10:00:00,45.0\n"
        "2026-06-01 11:00:00,12.0\n"
    )

    # 1. Validate as Household (threshold 15 kW) -> 45 kW must be rejected
    val_house = validate_csv_dataset(
        file_bytes=csv_content.encode("utf-8"),
        timestamp_col="timestamp",
        energy_col="active_power",
        building_type="household",
    )
    assert val_house["valid_count"] == 1
    assert val_house["invalid_count"] == 1
    assert "spike" in val_house["rejected_sample"][0]["reason"].lower()

    # 2. Validate as Commercial (threshold 1000 kW) -> 45 kW must be accepted
    val_comm = validate_csv_dataset(
        file_bytes=csv_content.encode("utf-8"),
        timestamp_col="timestamp",
        energy_col="active_power",
        building_type="commercial",
    )
    assert val_comm["valid_count"] == 2
    assert val_comm["invalid_count"] == 0


def test_import_unit_conversion_and_chronology():
    """Verify unit scaling (Wh -> kWh) and chronological sorting of non-ordered rows."""
    csv_unordered = (
        "timestamp,active_power\n"
        "2026-06-01 12:00:00,2000.0\n"
        "2026-06-01 10:00:00,1500.0\n"
    )
    res = validate_csv_dataset(
        file_bytes=csv_unordered.encode("utf-8"),
        timestamp_col="timestamp",
        energy_col="active_power",
        unit="Wh",
        building_type="household",
    )
    assert res["valid_count"] == 2
    assert res["is_chronological"] is False
    # Valid records must be chronologically sorted after ingestion
    assert res["valid_records"][0]["timestamp"] == "2026-06-01 10:00:00"
    # 1500 Wh converted to 1.5 kWh
    assert res["valid_records"][0]["energy_kwh"] == 1.5
    # 2000 Wh converted to 2.0 kWh
    assert res["valid_records"][1]["energy_kwh"] == 2.0


def test_permutation_explainability_and_calibration():
    """Verify that permutation explainability and calibrated prediction intervals are computed dynamically."""
    res = client.post("/api/forecast", json={"horizon_hours": 24, "confidence_level": 0.95, "building_id": 1})
    assert res.status_code == 200
    data = res.json()

    # Model metadata
    assert data["model_version"] == "2.0.0"
    assert "top_features" in data
    assert len(data["top_features"]) >= 3

    # Empirical calibration
    calib = data["interval_calibration"]
    assert calib is not None
    assert calib["is_adequately_calibrated"] is True
    assert calib["empirical_coverage_pct"] >= 85.0

    # Verify metrics file metadata contains residual distribution and permutation feature importances
    if METRICS_FILE.exists():
        with open(METRICS_FILE, "r") as f:
            meta = json.load(f)
            assert "feature_importances" in meta
            assert "residual_distribution" in meta
            assert "coverage_90_pct" in meta["residual_distribution"]
            assert "coverage_95_pct" in meta["residual_distribution"]


def test_all_building_archetypes_supported():
    """Verify that household, commercial, office, laboratory, and classroom facility types are registered."""
    res = client.get("/api/buildings")
    assert res.status_code == 200
    buildings = res.json()
    types_found = {b["building_type"] for b in buildings}
    assert {"household", "commercial", "office", "laboratory", "classroom"}.issubset(types_found)
