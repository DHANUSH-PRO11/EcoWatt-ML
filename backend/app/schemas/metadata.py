from typing import Dict, Any, List, Optional
from pydantic import BaseModel


class MetricScore(BaseModel):
    mae: float
    rmse: float
    r2: float


class ModelMetricsResponse(BaseModel):
    trained_at: str
    best_model_name: str
    dataset_rows: int
    train_rows: int
    val_rows: int
    test_rows: int
    residual_std: float
    is_simulated: bool
    feature_columns: List[str]
    validation_metrics: Dict[str, MetricScore]
    test_metrics: Dict[str, MetricScore]
    best_model_validation: MetricScore
    best_model_test: MetricScore
