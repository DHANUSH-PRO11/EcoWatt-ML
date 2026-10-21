from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class AnomalyItem(BaseModel):
    id: int
    building_id: Optional[int] = None
    meter_id: Optional[int] = None
    timestamp: str
    energy_kwh: float
    baseline_kwh: float
    deviation_pct: float
    anomaly_score: float
    severity: str
    status: str
    explanation: Optional[str] = None
    acknowledged_at: Optional[str] = None
    resolved_at: Optional[str] = None
    resolution_notes: Optional[str] = None
    investigation_notes: Optional[str] = None
    false_positive: bool = False
    updated_by: Optional[str] = "system"
    detector_version: Optional[str] = "1.0.0"


class AnomalyAcknowledgeRequest(BaseModel):
    user_name: Optional[str] = "operator"


class AnomalyResolveRequest(BaseModel):
    resolution_notes: Optional[str] = Field("Resolved by user inspection", max_length=500)
    user_name: Optional[str] = "operator"


class AnomalyFeedbackRequest(BaseModel):
    false_positive: bool
    investigation_notes: Optional[str] = None
    user_name: Optional[str] = "operator"


class AnomalySurroundingPoint(BaseModel):
    timestamp: str
    energy_kwh: float
    is_event: bool


class AnomalyInvestigationResponse(BaseModel):
    alert: AnomalyItem
    building_name: Optional[str] = None
    meter_code: Optional[str] = None
    same_slot_typical_kwh: Optional[float] = None
    same_slot_std_kwh: Optional[float] = None
    surrounding_readings: List[AnomalySurroundingPoint]
    disclaimer: str = (
        "Statistical outlier detection flags unusual consumption based on deviation from historical baseline. "
        "It does not independently establish an electrical fault, theft, or specific appliance defect."
    )


class AnomalySeverityCount(BaseModel):
    low: int = 0
    medium: int = 0
    high: int = 0
    critical: int = 0


class AnomalyStatsResponse(BaseModel):
    total_anomalies: int
    new_count: int
    acknowledged_count: int
    resolved_count: int
    false_positive_count: int
    by_severity: AnomalySeverityCount
    by_building: Dict[str, int]


class AnomalyListResponse(BaseModel):
    total: int
    new_count: int
    acknowledged_count: int
    resolved_count: int
    false_positive_count: int = 0
    items: List[AnomalyItem]
