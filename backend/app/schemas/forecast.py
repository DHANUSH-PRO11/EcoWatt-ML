from typing import List
from pydantic import BaseModel, Field


class ForecastRequest(BaseModel):
    horizon_hours: int = Field(24, ge=1, le=168, description="Forecast horizon: 1 for next-hour, 24 for next-day, 168 for 7-day.")
    confidence_level: float = Field(0.95, ge=0.80, le=0.99, description="Prediction interval confidence level.")


class ForecastItem(BaseModel):
    step: int
    timestamp: str
    predicted_kwh: float
    lower_bound_kwh: float
    upper_bound_kwh: float
    unit: str = "kWh"
    model_name: str


class ForecastResponse(BaseModel):
    horizon_hours: int
    generated_at: str
    model_name: str
    total_predicted_kwh: float
    average_predicted_kwh: float
    peak_predicted_kwh: float
    predictions: List[ForecastItem]
