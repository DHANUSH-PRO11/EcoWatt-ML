import numpy as np
import pandas as pd
from ml.feature_engineering import create_calendar_features, create_lag_and_rolling_features, build_feature_pipeline


def test_calendar_features():
    df = pd.DataFrame(
        {
            "timestamp": ["2026-05-01 00:00:00", "2026-05-02 14:00:00"],
            "energy_kwh": [1.0, 2.0],
        }
    )
    res = create_calendar_features(df)
    assert res["hour"].iloc[0] == 0
    assert res["hour"].iloc[1] == 14
    assert res["is_weekend"].iloc[0] == 0  # Friday
    assert res["is_weekend"].iloc[1] == 1  # Saturday


def test_no_target_leakage_in_lags_and_rolling():
    # Construct sequence where y_t is strictly equal to t
    timestamps = pd.date_range("2026-01-01", periods=200, freq="1h")
    df = pd.DataFrame(
        {
            "timestamp": timestamps,
            "energy_kwh": np.arange(200, dtype=float),
        }
    )

    df_feats = create_lag_and_rolling_features(df)

    # Check lag_1: at index t, lag_1 must equal y_{t-1}
    for idx in range(1, 20):
        current_target = df_feats["energy_kwh"].iloc[idx]
        lag_1 = df_feats["lag_1"].iloc[idx]
        assert lag_1 == current_target - 1.0

    # Check rolling_mean_6 at index t:
    # Must be mean of y_{t-6} through y_{t-1}, completely excluding y_t!
    for idx in range(6, 20):
        expected_window = df["energy_kwh"].iloc[idx - 6 : idx]
        expected_mean = float(expected_window.mean())
        assert pytest.approx(df_feats["rolling_mean_6"].iloc[idx], 1e-4) == expected_mean


import pytest
