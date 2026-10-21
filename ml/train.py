import os
import json
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd
import joblib

from ml.config import (
    BEST_MODEL_FILE,
    BASELINE_MODEL_FILE,
    ISOLATION_FOREST_FILE,
    METRICS_FILE,
    TRAIN_RATIO,
    VAL_RATIO,
    TEST_RATIO,
    TARGET_COL,
    DATETIME_COL,
)
from ml.dataset import get_or_load_dataset
from ml.feature_engineering import build_feature_pipeline, FEATURE_COLUMNS
from ml.models import get_model_pipeline, evaluate_predictions, HistoricalAverageBaseline
from ml.anomaly import ConsumptionAnomalyDetector


def split_chronological(
    df: pd.DataFrame,
    train_ratio: float = TRAIN_RATIO,
    val_ratio: float = VAL_RATIO,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Chronological train/validation/test split.
    Guarantees no temporal leakage and no random shuffling.
    """
    n = len(df)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_df = df.iloc[:train_end].copy().reset_index(drop=True)
    val_df = df.iloc[train_end:val_end].copy().reset_index(drop=True)
    test_df = df.iloc[val_end:].copy().reset_index(drop=True)

    print(
        f"Chronological split: Train={len(train_df)} ({train_df[DATETIME_COL].min()} to {train_df[DATETIME_COL].max()}), "
        f"Val={len(val_df)} ({val_df[DATETIME_COL].min()} to {val_df[DATETIME_COL].max()}), "
        f"Test={len(test_df)} ({test_df[DATETIME_COL].min()} to {test_df[DATETIME_COL].max()})"
    )

    return train_df, val_df, test_df


def train_and_evaluate_models(
    force_generate_sample: bool = False,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Full reproducible pipeline:
    1. Loads dataset (UCI or realistic sample)
    2. Builds leak-free lag and rolling features
    3. Chronological train/val/test splits
    4. Trains 4 candidate models: Baseline, Linear Regression, Random Forest, HistGradientBoosting
    5. Evaluates on validation set and selects best model
    6. Evaluates holdout test set on all models
    7. Fits Isolation Forest for anomaly detection
    8. Persists best model, baseline model, anomaly detector, and comprehensive evaluation metrics
    """
    print("=" * 60)
    print("Starting EcoWatt ML Training & Evaluation Pipeline")
    print("=" * 60)

    # 1. Ingestion
    raw_df = get_or_load_dataset(force_generate_sample=force_generate_sample)
    is_simulated = bool(raw_df["is_simulated"].iloc[0]) if "is_simulated" in raw_df.columns else True

    # 2. Feature Engineering
    print("Constructing calendar, lag, and rolling features...")
    featured_df = build_feature_pipeline(raw_df, dt_col=DATETIME_COL, target_col=TARGET_COL)

    # 3. Chronological Splits
    train_df, val_df, test_df = split_chronological(featured_df)

    X_train, y_train = train_df[FEATURE_COLUMNS], train_df[TARGET_COL]
    X_val, y_val = val_df[FEATURE_COLUMNS], val_df[TARGET_COL]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df[TARGET_COL]

    # Models to train
    model_types = ["baseline", "linear_regression", "random_forest", "hist_gradient_boosting"]
    trained_models = {}
    validation_metrics = {}
    test_metrics = {}

    for model_name in model_types:
        print(f"\n--- Training {model_name} ---")
        model = get_model_pipeline(model_name, random_state=random_state)
        model.fit(X_train, y_train)
        trained_models[model_name] = model

        # Validation evaluation
        val_preds = model.predict(X_val)
        val_eval = evaluate_predictions(y_val.values, val_preds)
        validation_metrics[model_name] = val_eval
        print(f"Validation metrics for {model_name}: MAE={val_eval['mae']:.4f}, RMSE={val_eval['rmse']:.4f}, R2={val_eval['r2']:.4f}")

        # Test evaluation
        test_preds = model.predict(X_test)
        test_eval = evaluate_predictions(y_test.values, test_preds)
        test_metrics[model_name] = test_eval
        print(f"Test metrics for {model_name}: MAE={test_eval['mae']:.4f}, RMSE={test_eval['rmse']:.4f}, R2={test_eval['r2']:.4f}")

    # 4. Model Selection based strictly on Validation Performance (Lowest MAE)
    best_model_name = min(validation_metrics, key=lambda k: validation_metrics[k]["mae"])
    print(f"\n>>> Selected Best Model based on Validation MAE: '{best_model_name}' <<<")
    best_model = trained_models[best_model_name]

    # Compute validation residual standard deviation for prediction intervals
    val_preds_best = best_model.predict(X_val)
    val_residuals = y_val.values - val_preds_best
    residual_std = float(np.std(val_residuals))
    print(f"Validation residual standard deviation (for prediction intervals): {residual_std:.4f} kWh")

    # 5. Fit Isolation Forest on training data for anomaly detection
    print("\n--- Fitting Isolation Forest Anomaly Detector ---")
    anomaly_detector = ConsumptionAnomalyDetector(contamination=0.03, random_state=random_state)
    anomaly_detector.fit(train_df)
    print("Anomaly detector successfully trained.")

    # 6. Model Persistence
    print("\nPersisting artifacts...")
    joblib.dump(best_model, BEST_MODEL_FILE)
    joblib.dump(trained_models["baseline"], BASELINE_MODEL_FILE)
    anomaly_detector.save(ISOLATION_FOREST_FILE)

    from datetime import timezone
    metrics_payload = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_rows": len(raw_df),
        "train_rows": len(train_df),
        "val_rows": len(val_df),
        "test_rows": len(test_df),
        "is_simulated": is_simulated,
        "best_model_name": best_model_name,
        "residual_std": round(residual_std, 4),
        "feature_columns": FEATURE_COLUMNS,
        "validation_metrics": validation_metrics,
        "test_metrics": test_metrics,
        "best_model_validation": validation_metrics[best_model_name],
        "best_model_test": test_metrics[best_model_name],
    }

    with open(METRICS_FILE, "w") as f:
        json.dump(metrics_payload, f, indent=2)

    print(f"Saved best model to: {BEST_MODEL_FILE}")
    print(f"Saved metrics metadata to: {METRICS_FILE}")
    print("Training pipeline finished successfully.")

    return metrics_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train and evaluate EcoWatt forecasting models")
    parser.add_argument("--force-sample", action="store_true", help="Force regenerate synthetic sample data")
    args = parser.parse_args()

    train_and_evaluate_models(force_generate_sample=args.force_sample)
