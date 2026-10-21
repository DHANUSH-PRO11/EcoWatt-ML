import numpy as np
import pandas as pd
from typing import Dict, Any, Optional
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score


class HistoricalAverageBaseline(BaseEstimator, RegressorMixin):
    """
    Baseline forecaster that computes and predicts the historical average consumption
    for each specific (day_of_week, hour) combination observed during training.
    """

    def __init__(self):
        self.lookup_: Dict[Tuple[int, int], float] = {}
        self.global_mean_: float = 1.0

    def fit(self, X: pd.DataFrame, y: pd.Series):
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X)
        self.global_mean_ = float(np.mean(y))

        # Check if hour and day_of_week are in X
        if "hour" in X.columns and "day_of_week" in X.columns:
            temp = X[["day_of_week", "hour"]].copy()
            temp["target"] = y.values
            grouped = temp.groupby(["day_of_week", "hour"])["target"].mean()
            self.lookup_ = grouped.to_dict()
        else:
            # Fallback if raw numpy array
            self.lookup_ = {}
        return self

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if not isinstance(X, pd.DataFrame):
            X = pd.DataFrame(X)
        if "hour" in X.columns and "day_of_week" in X.columns:
            preds = []
            for _, row in X.iterrows():
                key = (int(row["day_of_week"]), int(row["hour"]))
                preds.append(self.lookup_.get(key, self.global_mean_))
            return np.array(preds)
        return np.full(len(X), self.global_mean_)


def get_model_pipeline(model_type: str, random_state: int = 42):
    """
    Factory creating configured model instances.
    """
    model_type = model_type.lower()

    if model_type == "baseline":
        return HistoricalAverageBaseline()

    elif model_type == "linear_regression":
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                ("regressor", LinearRegression()),
            ]
        )

    elif model_type == "random_forest":
        return RandomForestRegressor(
            n_estimators=100,
            max_depth=14,
            min_samples_split=5,
            min_samples_leaf=3,
            n_jobs=-1,
            random_state=random_state,
        )

    elif model_type == "hist_gradient_boosting":
        return HistGradientBoostingRegressor(
            max_iter=150,
            max_depth=9,
            learning_rate=0.07,
            min_samples_leaf=20,
            random_state=random_state,
        )

    else:
        raise ValueError(
            f"Unsupported model_type: '{model_type}'. Choose from 'baseline', 'linear_regression', 'random_forest', 'hist_gradient_boosting'."
        )


def evaluate_predictions(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Calculate MAE, RMSE, and R2 evaluation metrics.
    Clip negative predictions to 0 as energy consumption is strictly non-negative.
    """
    y_pred_clipped = np.clip(y_pred, a_min=0.0, a_max=None)

    mae = float(mean_absolute_error(y_true, y_pred_clipped))
    rmse = float(root_mean_squared_error(y_true, y_pred_clipped))
    r2 = float(r2_score(y_true, y_pred_clipped))

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
    }
