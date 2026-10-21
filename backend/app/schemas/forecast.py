from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    horizon_hours: int = Field(24, ge=1, le=168, description="Forecast horizon: 1 for next-hour, 24 for next-day, 168 for 7-day.")
    confidence_level: float = Field(0.95, ge=0.80, le=0.99, description="Prediction interval confidence level (0.90 or 0.95).")
    building_id: Optional[int] = Field(None, description="Optional building ID")
    meter_id: Optional[int] = Field(None, description="Optional meter ID")


class ForecastItem(BaseModel):
    step: int
    timestamp: str
    predicted_kwh: float
    baseline_kwh: float
    lower_bound_kwh: float
    upper_bound_kwh: float
    uncertainty_multiplier: float = 1.0
    unit: str = "kWh"
    model_name: str


class FeatureImportanceItem(BaseModel):
    feature: str
    importance_score: float
    importance_pct: float
    category: str  # 'lagged_consumption', 'rolling_window', 'calendar_cyclical'
    interpretation: str


class IntervalCalibrationMetric(BaseModel):
    nominal_confidence: float
    empirical_coverage_pct: float
    is_adequately_calibrated: bool
    residual_std: float
    evaluation_sample_size: int
    method: str = "Empirical validation residual scaling with recursive step-propagation"


class HistoricalContextPoint(BaseModel):
    timestamp: str
    actual_kwh: float


class ForecastResponse(BaseModel):
    horizon_hours: int
    generated_at: str
    model_name: str
    model_version: str = "1.0.0"
    trained_at: Optional[str] = None
    total_predicted_kwh: float
    total_baseline_kwh: float
    average_predicted_kwh: float
    peak_predicted_kwh: float
    predictions: List[ForecastItem]
    historical_context: List[HistoricalContextPoint] = []
    top_features: List[FeatureImportanceItem] = []
    interval_calibration: Optional[IntervalCalibrationMetric] = None
    explainability_disclaimer: str = (
        "Permutation and statistical feature importances measure predictive sensitivity across model features; "
        "they quantify statistical dependency rather than guaranteed physical causality."
    )
