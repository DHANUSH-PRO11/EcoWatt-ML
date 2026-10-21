import numpy as np
import pandas as pd
from typing import List, Tuple
from ml.config import LAG_HOURS, ROLLING_WINDOWS, TARGET_COL, DATETIME_COL

FEATURE_COLUMNS = [
    "hour",
    "day_of_week",
    "day_of_month",
    "month",
    "is_weekend",
    "sin_hour",
    "cos_hour",
    "sin_day_of_week",
    "cos_day_of_week",
    "sin_month",
    "cos_month",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_24",
    "lag_48",
    "lag_168",
    "rolling_mean_6",
    "rolling_mean_24",
    "rolling_std_24",
]


def create_calendar_features(df: pd.DataFrame, dt_col: str = DATETIME_COL) -> pd.DataFrame:
    """
    Extract calendar, cyclical, and weekend indicators from datetime column.
    """
    df = df.copy()
    dt = pd.to_datetime(df[dt_col])
    df["hour"] = dt.dt.hour
    df["day_of_week"] = dt.dt.dayofweek
    df["day_of_month"] = dt.dt.day
    df["month"] = dt.dt.month
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # Cyclical representations
    df["sin_hour"] = np.sin(2 * np.pi * df["hour"] / 24.0)
    df["cos_hour"] = np.cos(2 * np.pi * df["hour"] / 24.0)
    df["sin_day_of_week"] = np.sin(2 * np.pi * df["day_of_week"] / 7.0)
    df["cos_day_of_week"] = np.cos(2 * np.pi * df["day_of_week"] / 7.0)
    df["sin_month"] = np.sin(2 * np.pi * (df["month"] - 1) / 12.0)
    df["cos_month"] = np.cos(2 * np.pi * (df["month"] - 1) / 12.0)

    return df


def create_lag_and_rolling_features(
    df: pd.DataFrame,
    target_col: str = TARGET_COL,
    lag_hours: List[int] = None,
    rolling_windows: List[int] = None,
) -> pd.DataFrame:
    """
    Generate lag and rolling statistics strictly shifted by 1 hour to prevent target leakage.
    At timestamp t, only observations <= t-1 are used.
    """
    if lag_hours is None:
        lag_hours = LAG_HOURS
    if rolling_windows is None:
        rolling_windows = ROLLING_WINDOWS

    df = df.copy()

    # Shifted series for safe rolling calculations
    shifted_target = df[target_col].shift(1)

    for lag in lag_hours:
        df[f"lag_{lag}"] = df[target_col].shift(lag)

    for window in rolling_windows:
        df[f"rolling_mean_{window}"] = shifted_target.rolling(window=window, min_periods=window).mean()
        if window == 24:
            df[f"rolling_std_{window}"] = shifted_target.rolling(window=window, min_periods=window).std().fillna(0.0)

    return df


def build_feature_pipeline(
    df: pd.DataFrame,
    dt_col: str = DATETIME_COL,
    target_col: str = TARGET_COL,
    drop_na: bool = True,
) -> pd.DataFrame:
    """
    Full feature pipeline transforming raw time-series consumption into a machine-learning-ready DataFrame.
    """
    df = df.sort_values(dt_col).reset_index(drop=True)
    df = create_calendar_features(df, dt_col=dt_col)
    df = create_lag_and_rolling_features(df, target_col=target_col)

    if drop_na:
        # Maximum lag is 168 hours (7 days), drop initial rows where lag features are NaN
        df = df.dropna(subset=FEATURE_COLUMNS + [target_col]).reset_index(drop=True)

    return df


def prepare_single_step_features(
    history_df: pd.DataFrame,
    target_dt: pd.Timestamp,
    target_col: str = TARGET_COL,
    dt_col: str = DATETIME_COL,
) -> pd.DataFrame:
    """
    Constructs feature row for a future timestamp using only the known history up to target_dt - 1 hour.
    Ensures zero lookahead bias during recursive multi-step forecasting.
    """
    # Sort history
    history = history_df.sort_values(dt_col).copy()
    if len(history) < max(LAG_HOURS):
        raise ValueError(f"Need at least {max(LAG_HOURS)} historical hours to construct lagged features.")

    hour = target_dt.hour
    day_of_week = target_dt.dayofweek
    day_of_month = target_dt.day
    month = target_dt.month
    is_weekend = int(day_of_week >= 5)

    sin_hour = np.sin(2 * np.pi * hour / 24.0)
    cos_hour = np.cos(2 * np.pi * hour / 24.0)
    sin_day_of_week = np.sin(2 * np.pi * day_of_week / 7.0)
    cos_day_of_week = np.cos(2 * np.pi * day_of_week / 7.0)
    sin_month = np.sin(2 * np.pi * (month - 1) / 12.0)
    cos_month = np.cos(2 * np.pi * (month - 1) / 12.0)

    # Historical values from end of history series
    # history.iloc[-1] is target_dt - 1 hour
    # history.iloc[-2] is target_dt - 2 hours, etc.
    values = history[target_col].values

    lag_1 = values[-1]
    lag_2 = values[-2]
    lag_3 = values[-3]
    lag_24 = values[-24]
    lag_48 = values[-48]
    lag_168 = values[-168]

    rolling_mean_6 = float(np.mean(values[-6:]))
    rolling_mean_24 = float(np.mean(values[-24:]))
    rolling_std_24 = float(np.std(values[-24:], ddof=1)) if len(values[-24:]) > 1 else 0.0

    features = {
        "hour": hour,
        "day_of_week": day_of_week,
        "day_of_month": day_of_month,
        "month": month,
        "is_weekend": is_weekend,
        "sin_hour": sin_hour,
        "cos_hour": cos_hour,
        "sin_day_of_week": sin_day_of_week,
        "cos_day_of_week": cos_day_of_week,
        "sin_month": sin_month,
        "cos_month": cos_month,
        "lag_1": lag_1,
        "lag_2": lag_2,
        "lag_3": lag_3,
        "lag_24": lag_24,
        "lag_48": lag_48,
        "lag_168": lag_168,
        "rolling_mean_6": rolling_mean_6,
        "rolling_mean_24": rolling_mean_24,
        "rolling_std_24": rolling_std_24,
    }

    return pd.DataFrame([features])[FEATURE_COLUMNS]
