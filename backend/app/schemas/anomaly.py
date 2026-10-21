from typing import List, Optional
from pydantic import BaseModel, Field


class AnomalyItem(BaseModel):
    id: int
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


class AnomalyAcknowledgeRequest(BaseModel):
    pass


class AnomalyResolveRequest(BaseModel):
    resolution_notes: Optional[str] = Field("Resolved by user inspection", max_length=500)


class AnomalyListResponse(BaseModel):
    total: int
    new_count: int
    acknowledged_count: int
    resolved_count: int
    items: List[AnomalyItem]
