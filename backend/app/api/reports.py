from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.report_service import (
    generate_energy_csv,
    generate_forecast_csv,
    generate_anomalies_csv,
    get_executive_summary_report,
)

router = APIRouter(prefix="/api/reports", tags=["Reports & Exports"])


@router.get("/export-csv")
def download_csv_export(
    export_type: str = Query("energy", pattern="^(energy|forecast|anomalies)$"),
    building_id: Optional[int] = Query(None),
    limit: int = Query(2000, ge=1, le=10000),
    db: Session = Depends(get_db),
):
    """Download exportable CSV data for energy readings, multi-step forecasts, or anomaly alerts."""
    now_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    if export_type == "energy":
        content = generate_energy_csv(db, building_id=building_id, limit=limit)
        filename = f"ecowatt_energy_readings_{now_str}.csv"
    elif export_type == "forecast":
        content = generate_forecast_csv(db, limit=limit)
        filename = f"ecowatt_forecast_records_{now_str}.csv"
    elif export_type == "anomalies":
        content = generate_anomalies_csv(db, building_id=building_id)
        filename = f"ecowatt_anomalies_{now_str}.csv"
    else:
        raise HTTPException(status_code=400, detail="Invalid export type")

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/summary")
def get_summary_report(
    building_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Generate structured executive energy intelligence summary report."""
    try:
        return get_executive_summary_report(db, building_id=building_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary report: {str(e)}")
