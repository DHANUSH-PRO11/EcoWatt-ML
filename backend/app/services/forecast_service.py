from datetime import datetime, timezone
from typing import List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.models.energy import EnergyReading
from backend.app.models.forecast import ForecastRecord
from backend.app.schemas.forecast import ForecastRequest, ForecastResponse, ForecastItem
from ml.forecast import RecursiveForecaster


def generate_forecast(
    db: Session,
    request: ForecastRequest,
) -> ForecastResponse:
    # 1. Fetch recent continuous historical readings from DB
    # We require at least 168 hours (7 days) for the lag_168 feature
    readings = (
        db.query(EnergyReading)
        .order_by(EnergyReading.timestamp.desc())
        .limit(250)
        .all()
    )

    if len(readings) < 168:
        raise ValueError(
            f"Insufficient historical data in database ({len(readings)} hours found). "
            f"At least 168 hours of continuous energy readings are required for accurate recursive forecasting."
        )

    # Reverse into chronological order
    readings = list(reversed(readings))

    df_history = pd.DataFrame(
        [
            {
                "timestamp": r.timestamp,
                "energy_kwh": r.energy_kwh,
            }
            for r in readings
        ]
    )

    # 2. Invoke ML Recursive Forecaster
    forecaster = RecursiveForecaster()
    raw_predictions = forecaster.forecast(
        history_df=df_history,
        horizon_hours=request.horizon_hours,
        confidence_level=request.confidence_level,
    )

    # 3. Persist forecast records to database
    generated_now = datetime.now(timezone.utc)
    db_records = [
        ForecastRecord(
            generated_at=generated_now,
            horizon_hours=request.horizon_hours,
            target_timestamp=pd.to_datetime(p["timestamp"]),
            predicted_kwh=p["predicted_kwh"],
            lower_bound_kwh=p["lower_bound_kwh"],
            upper_bound_kwh=p["upper_bound_kwh"],
            model_name=p["model_name"],
        )
        for p in raw_predictions
    ]
    db.add_all(db_records)
    db.commit()

    # 4. Compute forecast aggregations
    pred_items = [
        ForecastItem(
            step=p["step"],
            timestamp=p["timestamp"],
            predicted_kwh=p["predicted_kwh"],
            lower_bound_kwh=p["lower_bound_kwh"],
            upper_bound_kwh=p["upper_bound_kwh"],
            unit=p["unit"],
            model_name=p["model_name"],
        )
        for p in raw_predictions
    ]

    vals = [p.predicted_kwh for p in pred_items]
    total_pred = round(float(sum(vals)), 2)
    avg_pred = round(float(sum(vals) / len(vals)), 3)
    peak_pred = round(float(max(vals)), 3)

    return ForecastResponse(
        horizon_hours=request.horizon_hours,
        generated_at=generated_now.strftime("%Y-%m-%d %H:%M:%S"),
        model_name=forecaster.model_name,
        total_predicted_kwh=total_pred,
        average_predicted_kwh=avg_pred,
        peak_predicted_kwh=peak_pred,
        predictions=pred_items,
    )


def get_forecast_history(db: Session, limit: int = 168) -> List[ForecastItem]:
    """Retrieve recent forecast records."""
    records = (
        db.query(ForecastRecord)
        .order_by(ForecastRecord.target_timestamp.desc())
        .limit(limit)
        .all()
    )
    records = list(reversed(records))
    return [
        ForecastItem(
            step=idx + 1,
            timestamp=r.target_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            predicted_kwh=round(r.predicted_kwh, 3),
            lower_bound_kwh=round(r.lower_bound_kwh, 3),
            upper_bound_kwh=round(r.upper_bound_kwh, 3),
            unit="kWh",
            model_name=r.model_name,
        )
        for idx, r in enumerate(records)
    ]
