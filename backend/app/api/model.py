import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.metadata import ModelMetricsResponse
from backend.app.models.metadata import ModelEvaluationMeta
from ml.config import METRICS_FILE
from ml.train import train_and_evaluate_models

router = APIRouter(prefix="/api/model", tags=["Model & ML Ops"])


@router.get("/metrics", response_model=ModelMetricsResponse)
def get_model_metrics(db: Session = Depends(get_db)):
    """Retrieve evaluation metrics (MAE, RMSE, R2) for all candidate models and selected production forecaster."""
    if not METRICS_FILE.exists():
        raise HTTPException(status_code=404, detail="Model evaluation metrics file not found. Please train models first.")

    try:
        with open(METRICS_FILE, "r") as f:
            metrics_data = json.load(f)
        return metrics_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read model metrics: {str(e)}")


@router.post("/train")
def retrain_model_pipeline(
    force_sample: bool = False,
    db: Session = Depends(get_db),
):
    """
    Trigger reproducible retraining and evaluation of all candidate forecasting models:
    Baseline, Linear Regression, Random Forest, and HistGradientBoostingRegressor.
    Chronologically splits data, evaluates validation & test sets, and saves the top-performing artifact.
    """
    try:
        metrics_data = train_and_evaluate_models(force_generate_sample=force_sample)

        # Update database metadata record
        db.query(ModelEvaluationMeta).update({ModelEvaluationMeta.is_active: False})
        best_name = metrics_data["best_model_name"]
        best_val = metrics_data["validation_metrics"][best_name]
        best_test = metrics_data["test_metrics"][best_name]

        meta_record = ModelEvaluationMeta(
            trained_at=datetime.fromisoformat(metrics_data["trained_at"].replace("Z", "+00:00")),
            best_model_name=best_name,
            dataset_rows=metrics_data["dataset_rows"],
            val_mae=best_val["mae"],
            val_rmse=best_val["rmse"],
            val_r2=best_val["r2"],
            test_mae=best_test["mae"],
            test_rmse=best_test["rmse"],
            test_r2=best_test["r2"],
            residual_std=metrics_data["residual_std"],
            all_metrics_json=json.dumps(metrics_data),
            is_active=True,
        )
        db.add(meta_record)
        db.commit()

        return {
            "status": "success",
            "message": f"Successfully trained and evaluated models. Best model: '{best_name}'.",
            "metrics": metrics_data,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Model retraining failed: {str(e)}")
