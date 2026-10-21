from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class EnergySavingInsight(BaseModel):
    id: str
    title: str
    category: str  # 'baseload', 'peak_usage', 'weekend', 'anomalous_spikes', 'efficiency'
    severity: str  # 'low', 'medium', 'high'
    potential_savings_kwh: float
    potential_savings_currency: float
    triggering_pattern: str
    actionable_recommendation: str
    measured_metrics: Dict[str, Any]


class InsightsResponse(BaseModel):
    generated_at: str
    total_potential_monthly_savings_kwh: float
    total_potential_monthly_savings_currency: float
    currency: str
    currency_symbol: str
    insights: List[EnergySavingInsight]
    baseload_analysis: Dict[str, Any]
    peak_hours_analysis: Dict[str, Any]
    weekend_vs_weekday_analysis: Dict[str, Any]
    hourly_distribution: List[Dict[str, Any]]
