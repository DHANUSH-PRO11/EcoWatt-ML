from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class EnergyReadingItem(BaseModel):
    timestamp: str
    energy_kwh: float
    reactive_power_kvar: Optional[float] = None
    voltage: Optional[float] = None
    global_intensity: Optional[float] = None
    sub_metering_1_kwh: Optional[float] = 0.0
    sub_metering_2_kwh: Optional[float] = 0.0
    sub_metering_3_kwh: Optional[float] = 0.0
    sub_metering_other_kwh: Optional[float] = 0.0
    is_simulated: bool = False


class EnergyHistoryResponse(BaseModel):
    total_records: int
    start_time: str
    end_time: str
    total_kwh: float
    avg_hourly_kwh: float
    peak_hourly_kwh: float
    readings: List[EnergyReadingItem]


class AnalyticsAggregateItem(BaseModel):
    period: str
    total_kwh: float
    avg_kwh: float
    peak_kwh: float
    min_kwh: float
    sub_1_kwh: float
    sub_2_kwh: float
    sub_3_kwh: float
    sub_other_kwh: float


class EnergyAnalyticsResponse(BaseModel):
    aggregation: str  # 'hourly', 'daily', 'monthly'
    start_date: str
    end_date: str
    total_kwh: float
    average_kwh: float
    peak_kwh: float
    min_kwh: float
    total_sub_1_kwh: float
    total_sub_2_kwh: float
    total_sub_3_kwh: float
    total_sub_other_kwh: float
    series: List[AnalyticsAggregateItem]
