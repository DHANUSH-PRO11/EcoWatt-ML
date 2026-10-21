import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_csv_preview_and_validation():
    # Valid CSV content
    csv_content = (
        "timestamp,active_power,kitchen,laundry,hvac\n"
        "2026-06-01 00:00:00,1.25,0.1,0.0,0.5\n"
        "2026-06-01 01:00:00,1.10,0.0,0.0,0.4\n"
        "2026-06-01 02:00:00,0.95,0.0,0.0,0.3\n"
        "2026-06-01 03:00:00,-0.50,0.0,0.0,0.3\n"  # Invalid negative row
    )

    # Preview
    preview_res = client.post(
        "/api/import/preview",
        files={"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
    )
    assert preview_res.status_code == 200
    p_data = preview_res.json()
    assert "timestamp" in p_data["columns"]
    assert "active_power" in p_data["columns"]

    # Validate
    val_res = client.post(
        "/api/import/validate",
        files={"file": ("test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")},
        data={"timestamp_col": "timestamp", "energy_col": "active_power", "separator": ","},
    )
    assert val_res.status_code == 200
    v_data = val_res.json()
    assert v_data["valid_count"] == 3
    assert v_data["invalid_count"] == 1
    assert len(v_data["rejected_sample"]) == 1
    assert "Negative" in v_data["rejected_sample"][0]["reason"]


def test_notifications_lifecycle():
    # Fetch notifications
    res = client.get("/api/notifications")
    assert res.status_code == 200
    notifs = res.json()
    assert isinstance(notifs, list)

    # Read unread count
    count_res = client.get("/api/notifications/unread-count")
    assert count_res.status_code == 200
    assert "unread_count" in count_res.json()

    # Mark all read
    read_all_res = client.post("/api/notifications/read-all")
    assert read_all_res.status_code == 200


def test_reports_csv_and_summary():
    # Energy CSV
    res_energy = client.get("/api/reports/export-csv?export_type=energy&limit=10")
    assert res_energy.status_code == 200
    assert "text/csv" in res_energy.headers["content-type"]
    assert "timestamp" in res_energy.text

    # Forecast CSV
    res_forecast = client.get("/api/reports/export-csv?export_type=forecast&limit=10")
    assert res_forecast.status_code == 200
    assert "predicted_kwh" in res_forecast.text

    # Anomalies CSV
    res_anom = client.get("/api/reports/export-csv?export_type=anomalies")
    assert res_anom.status_code == 200
    assert "anomaly_score" in res_anom.text

    # Summary Report
    res_summary = client.get("/api/reports/summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    assert "report_title" in summary
    assert "facility_scope" in summary
    assert "ml_model_metadata" in summary


def test_audit_logs():
    res = client.get("/api/audit-logs?limit=10")
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    if logs:
        assert "action" in logs[0]
        assert "timestamp" in logs[0]


def test_advanced_analytics_routes():
    res_comp = client.get("/api/analytics/advanced/comparisons")
    assert res_comp.status_code == 200
    data = res_comp.json()
    assert "day_over_day" in data
    assert "week_over_week" in data
    assert "month_over_month" in data
    assert "weekday_vs_weekend" in data

    res_heat = client.get("/api/analytics/advanced/heatmap")
    assert res_heat.status_code == 200
    h_data = res_heat.json()
    assert "matrix" in h_data
    assert len(h_data["matrix"]) == 7

    res_base = client.get("/api/analytics/advanced/baseload-peak")
    assert res_base.status_code == 200
    b_data = res_base.json()
    assert "avg_baseload_kwh" in b_data
    assert "baseload_to_peak_ratio" in b_data
