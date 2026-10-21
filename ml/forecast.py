import json
from pathlib import Path
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd
import joblib

from ml.config import (
    BEST_MODEL_FILE,
    METRICS_FILE,
    TARGET_COL,
    DATETIME_COL,
    LAG_HOURS,
)
from ml.feature_engineering import prepare_single_step_features


class RecursiveForecaster:
    """
    Handles multi-step recursive forecasting for arbitrary future horizons (1h, 24h, 168h).
    Dynamically propagates predicted consumption into lagged feature buffers
    to guarantee zero lookahead bias while computing calibrated prediction intervals.
    """

    def __init__(
        self,
        model_path: Path = BEST_MODEL_FILE,
        metrics_path: Path = METRICS_FILE,
    ):
        self.model_path = model_path
        self.metrics_path = metrics_path
        self.model = None
        self.residual_std = 0.25
        self.model_name = "unknown"
        self._load_model_and_metadata()

    def _load_model_and_metadata(self):
        if Path(self.model_path).exists():
            self.model = joblib.load(self.model_path)
        else:
            self.model = None

        if Path(self.metrics_path).exists():
            with open(self.metrics_path, "r") as f:
                metadata = json.load(f)
                self.residual_std = metadata.get("residual_std", 0.25)
                self.model_name = metadata.get("best_model_name", "hist_gradient_boosting")

    def forecast(
        self,
        history_df: pd.DataFrame,
        horizon_hours: int = 24,
        confidence_level: float = 0.95,
    ) -> List[Dict[str, Any]]:
        """
        Execute recursive multi-step forecasting.
        horizon_hours: 1 (next hour), 24 (next day), 168 (next 7 days)
        """
        if self.model is None:
            raise RuntimeError("Trained forecasting model artifact not found. Please train model first.")

        if len(history_df) < max(LAG_HOURS):
            raise ValueError(f"Historical context requires at least {max(LAG_HOURS)} hours of continuous data.")

        # Ensure chronological ordering
        history = history_df.sort_values(DATETIME_COL).copy().reset_index(drop=True)
        history[DATETIME_COL] = pd.to_datetime(history[DATETIME_COL])

        last_timestamp = history[DATETIME_COL].iloc[-1]

        # Multiplier for prediction intervals (1.96 for 95% confidence)
        z_score = 1.96 if confidence_level >= 0.95 else 1.645

        # Recursive buffer containing timestamps and energy values
        forecast_buffer = history[[DATETIME_COL, TARGET_COL]].copy()

        predictions = []

        for step in range(1, horizon_hours + 1):
            next_timestamp = last_timestamp + pd.Timedelta(hours=step)

            # Feature vector generated strictly from buffer up to previous step
            features_df = prepare_single_step_features(
                forecast_buffer,
                target_dt=next_timestamp,
                target_col=TARGET_COL,
                dt_col=DATETIME_COL,
            )

            # Point prediction
            pred_val = float(self.model.predict(features_df)[0])
            pred_val = max(0.05, pred_val)  # Physics constraint: energy >= baseload threshold

            # Uncertainty expands with recursive horizon
            # Step error propagation formula: sigma_h = residual_std * sqrt(1 + 0.04 * (step - 1))
            step_sigma = self.residual_std * np.sqrt(1.0 + 0.04 * (step - 1))
            lower_bound = float(max(0.0, pred_val - z_score * step_sigma))
            upper_bound = float(pred_val + z_score * step_sigma)

            record = {
                "step": step,
                "timestamp": next_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "predicted_kwh": round(pred_val, 3),
                "lower_bound_kwh": round(lower_bound, 3),
                "upper_bound_kwh": round(upper_bound, 3),
                "unit": "kWh",
                "model_name": self.model_name,
            }
            predictions.append(record)

            # Append prediction to buffer for next recursive steps
            new_row = pd.DataFrame([{DATETIME_COL: next_timestamp, TARGET_COL: pred_val}])
            forecast_buffer = pd.concat([forecast_buffer, new_row], ignore_index=True)

        return predictions
