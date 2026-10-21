import numpy as np
import pandas as pd
from ml.models import evaluate_predictions, HistoricalAverageBaseline, get_model_pipeline
from ml.forecast import RecursiveForecaster


def test_evaluation_metrics_exact():
    y_true = np.array([1.0, 2.0, 3.0, 4.0])
    y_pred = np.array([1.0, 2.0, 3.0, 4.0])
    metrics = evaluate_predictions(y_true, y_pred)
    assert metrics["mae"] == 0.0
    assert metrics["rmse"] == 0.0
    assert metrics["r2"] == 1.0


def test_baseline_forecaster():
    X = pd.DataFrame(
        {
            "day_of_week": [0, 0, 1, 1],
            "hour": [10, 10, 14, 14],
        }
    )
    y = pd.Series([1.5, 2.5, 3.0, 4.0])
    baseline = HistoricalAverageBaseline()
    baseline.fit(X, y)

    # Monday 10h mean should be (1.5 + 2.5) / 2 = 2.0
    pred = baseline.predict(pd.DataFrame([{"day_of_week": 0, "hour": 10}]))
    assert pred[0] == 2.0

    # Tuesday 14h mean should be (3.0 + 4.0) / 2 = 3.5
    pred2 = baseline.predict(pd.DataFrame([{"day_of_week": 1, "hour": 14}]))
    assert pred2[0] == 3.5


def test_model_pipeline_factory():
    for mtype in ["baseline", "linear_regression", "random_forest", "hist_gradient_boosting"]:
        model = get_model_pipeline(mtype)
        assert model is not None
