from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
from backend.app.database import Base


class ModelEvaluationMeta(Base):
    __tablename__ = "model_evaluation_metadata"

    id = Column(Integer, primary_key=True, index=True)
    trained_at = Column(DateTime, nullable=False)
    best_model_name = Column(String(64), nullable=False)
    dataset_rows = Column(Integer, nullable=False)
    val_mae = Column(Float, nullable=False)
    val_rmse = Column(Float, nullable=False)
    val_r2 = Column(Float, nullable=False)
    test_mae = Column(Float, nullable=False)
    test_rmse = Column(Float, nullable=False)
    test_r2 = Column(Float, nullable=False)
    residual_std = Column(Float, nullable=False)
    all_metrics_json = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class DataImportMeta(Base):
    __tablename__ = "data_import_metadata"

    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(128), nullable=False)
    imported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    total_rows = Column(Integer, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    is_simulated = Column(Boolean, default=False, nullable=False)
