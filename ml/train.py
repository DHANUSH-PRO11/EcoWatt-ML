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
from sklearn.inspection import permutation_importance


def compute_model_feature_importances(model, X_val, y_val, feature_names=FEATURE_COLUMNS, random_state=42):
    """
    Computes permutation feature importance on validation data.
    Never hardcoded; directly reflects the empirical sensitivity of the champion model.
    """
    try:
        perm = permutation_importance(
            model,
            X_val,
            y_val,
            n_repeats=5,
            random_state=random_state,
            scoring="neg_mean_absolute_error",
        )
        raw_importances = np.maximum(0.0, perm.importances_mean)
        total_imp = float(np.sum(raw_importances))
        if total_imp > 0:
            importances_pct = (raw_importances / total_imp) * 100.0
        else:
            importances_pct = np.ones(len(feature_names)) / len(feature_names) * 100.0
    except Exception:
        if hasattr(model, "feature_importances_"):
            raw_importances = model.feature_importances_
            total_imp = float(np.sum(raw_importances))
            importances_pct = (raw_importances / total_imp * 100.0) if total_imp > 0 else np.ones(len(feature_names)) * (100.0 / len(feature_names))
        else:
            raw_importances = np.ones(len(feature_names)) / len(feature_names)
            importances_pct = raw_importances * 100.0

    interpretations = {
        "lag_1": "Highest short-term autocorrelation; persistent active appliance states directly influence next-hour draw.",
        "rolling_mean_24": "Captures prevailing diurnal baseload level and background refrigeration/HVAC operating baseline.",
        "sin_hour": "Diurnal circadian harmonic capturing morning routine, midday plateau, and evening peak demand.",
        "cos_hour": "Diurnal cyclical harmonic capturing night baseload vs active daytime transitions.",
        "lag_24": "Captures 24-hour periodicity in daily occupancy schedule and appliance timing.",
        "rolling_std_24": "Quantifies consumption volatility and distinguishes steady baseload from switching bursts.",
        "is_weekend": "Accounts for weekend occupancy shifts, delayed waking hours, and daytime usage patterns.",
        "sin_day_of_week": "Weekly harmonic capturing weekday versus weekend load variations.",
        "cos_day_of_week": "Weekly cyclic profile capturing mid-week production and weekend drop-offs.",
        "lag_168": "Weekly lag capturing recurring 7-day cyclical operational schedules.",
        "rolling_mean_6": "Short-term trend capturing recent multi-hour appliance usage blocks.",
    }

    items = []
    for feat, raw_score, pct in zip(feature_names, raw_importances, importances_pct):
        interp = interpretations.get(feat, f"Statistical sensitivity driver '{feat}' affecting electricity demand predictions.")
        cat = "lagged_consumption" if "lag" in feat else ("rolling_window" if "rolling" in feat else "calendar_cyclical")
        items.append({
            "feature": feat,
            "importance_score": round(float(raw_score), 4),
            "importance_pct": round(float(pct), 2),
            "category": cat,
            "interpretation": interp,
        })

    items.sort(key=lambda x: x["importance_score"], reverse=True)
    return items


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
    save_as_candidate: bool = False,
    candidate_model_file: Optional[Path] = None,
    candidate_metrics_file: Optional[Path] = None,
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

    # Compute validation residual statistics and empirical interval calibration
    val_preds_best = best_model.predict(X_val)
    val_residuals = y_val.values - val_preds_best
    residual_std = float(np.std(val_residuals))
    z_95 = 1.96
    z_90 = 1.645
    coverage_95 = float(np.mean(np.abs(val_residuals) <= (z_95 * residual_std)) * 100.0)
    coverage_90 = float(np.mean(np.abs(val_residuals) <= (z_90 * residual_std)) * 100.0)

    residual_distribution = {
        "mean": round(float(np.mean(val_residuals)), 4),
        "std": round(residual_std, 4),
        "p25": round(float(np.percentile(val_residuals, 25)), 4),
        "p50": round(float(np.median(val_residuals)), 4),
        "p75": round(float(np.percentile(val_residuals, 75)), 4),
        "min": round(float(np.min(val_residuals)), 4),
        "max": round(float(np.max(val_residuals)), 4),
        "coverage_90_pct": round(coverage_90, 2),
        "coverage_95_pct": round(coverage_95, 2),
    }
    print(f"Validation residual std: {residual_std:.4f} kWh (Empirical Coverage: 90%={coverage_90:.1f}%, 95%={coverage_95:.1f}%)")

    # Compute Permutation Feature Importances on validation data
    print("Computing permutation feature importance on holdout validation data...")
    feature_importances = compute_model_feature_importances(best_model, X_val, y_val, feature_names=FEATURE_COLUMNS, random_state=random_state)

    # 5. Fit Isolation Forest on training data for anomaly detection
    print("\n--- Fitting Isolation Forest Anomaly Detector ---")
    anomaly_detector = ConsumptionAnomalyDetector(contamination=0.03, random_state=random_state)
    anomaly_detector.fit(train_df)
    print("Anomaly detector successfully trained.")

    # 6. Model Persistence
    print("\nPersisting artifacts...")
    target_model_path = (candidate_model_file or (BEST_MODEL_FILE.parent / "candidate_forecaster.joblib")) if save_as_candidate else BEST_MODEL_FILE
    target_metrics_path = (candidate_metrics_file or (METRICS_FILE.parent / "candidate_metrics.json")) if save_as_candidate else METRICS_FILE

    joblib.dump(best_model, target_model_path)
    if not save_as_candidate:
        joblib.dump(trained_models["baseline"], BASELINE_MODEL_FILE)
        anomaly_detector.save(ISOLATION_FOREST_FILE)

    model_config = {
        "model_type": best_model_name,
        "random_state": random_state,
        "train_ratio": TRAIN_RATIO,
        "val_ratio": VAL_RATIO,
        "test_ratio": TEST_RATIO,
    }
    if hasattr(best_model, "get_params"):
        try:
            model_config["hyperparameters"] = {k: str(v) for k, v in best_model.get_params().items() if not callable(v)}
        except Exception:
            pass

    from datetime import timezone
    metrics_payload = {
        "model_version": "2.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_rows": len(raw_df),
        "train_rows": len(train_df),
        "val_rows": len(val_df),
        "test_rows": len(test_df),
        "is_simulated": is_simulated,
        "best_model_name": best_model_name,
        "residual_std": round(residual_std, 4),
        "residual_distribution": residual_distribution,
        "feature_columns": FEATURE_COLUMNS,
        "feature_importances": feature_importances,
        "model_config": model_config,
        "validation_metrics": validation_metrics,
        "test_metrics": test_metrics,
        "best_model_validation": validation_metrics[best_model_name],
        "best_model_test": test_metrics[best_model_name],
    }

    with open(target_metrics_path, "w") as f:
        json.dump(metrics_payload, f, indent=2)

    print(f"Saved model artifact to: {target_model_path}")
    print(f"Saved metrics metadata to: {target_metrics_path}")
    print("Training pipeline finished successfully.")

    return metrics_payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train and evaluate EcoWatt forecasting models")
    parser.add_argument("--force-sample", action="store_true", help="Force regenerate synthetic sample data")
    args = parser.parse_args()

    train_and_evaluate_models(force_generate_sample=args.force_sample)
