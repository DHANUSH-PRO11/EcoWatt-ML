from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text, Index
from backend.app.database import Base


class ModelTrainingRecord(Base):
    __tablename__ = "model_training_records"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(32), nullable=False, default="running")  # 'running', 'completed', 'failed', 'rolled_back'
    initiated_by = Column(String(64), nullable=False, default="user_manual")
    dataset_version = Column(String(128), nullable=False, default="default")
    dataset_rows = Column(Integer, nullable=True)
    model_candidates_json = Column(Text, nullable=True)
    best_candidate_name = Column(String(64), nullable=True)
    val_mae = Column(Float, nullable=True)
    val_rmse = Column(Float, nullable=True)
    val_r2 = Column(Float, nullable=True)
    test_mae = Column(Float, nullable=True)
    test_rmse = Column(Float, nullable=True)
    test_r2 = Column(Float, nullable=True)
    promoted = Column(Boolean, default=False, nullable=False)
    promotion_reason = Column(String(256), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    __table_args__ = (
        Index("idx_training_created_desc", created_at.desc()),
    )
