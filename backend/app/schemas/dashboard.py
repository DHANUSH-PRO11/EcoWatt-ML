from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from backend.app.schemas.anomaly import AnomalyItem
from backend.app.schemas.billing import BillEstimateResponse


class DashboardSummaryResponse(BaseModel):
    # KPIs
    today_consumption_kwh: float
    today_vs_yesterday_pct: float
    billing_period_consumption_kwh: float
    billing_period_days: int
    predicted_next_day_kwh: float
    estimated_bill: BillEstimateResponse
    change_vs_previous_period_pct: float
    data_source: str
    is_simulated: bool
    last_updated: str

    # Alert summary
    active_anomalies_count: int
    recent_anomalies: List[AnomalyItem]

    # Chart datasets
    recent_hourly_trend: List[Dict[str, Any]]
    actual_vs_predicted_trend: List[Dict[str, Any]]
    submetering_breakdown: Dict[str, float]
