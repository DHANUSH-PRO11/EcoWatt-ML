import numpy as np
import pandas as pd
from ml.anomaly import ConsumptionAnomalyDetector


def test_anomaly_detector_fit_and_score():
    # Construct normal distribution readings
    np.random.seed(42)
    n = 300
    df = pd.DataFrame(
        {
            "energy_kwh": np.random.normal(1.0, 0.2, size=n),
            "hour": np.random.randint(0, 24, size=n),
            "is_weekend": np.random.randint(0, 2, size=n),
            "timestamp": pd.date_range("2026-01-01", periods=n, freq="1h").strftime("%Y-%m-%d %H:%M:%S"),
        }
    )

    detector = ConsumptionAnomalyDetector(contamination=0.05)
    detector.fit(df)
    assert detector.is_fitted

    scores = detector.score_samples(df)
    assert len(scores) == n
    assert (scores >= 0.0).all()
    assert (scores <= 1.0).all()


def test_extreme_spike_detection():
    # Normal data + 1 extreme spike
    normal_energies = [1.0] * 50
    spike_energies = normal_energies + [8.5]  # Massive spike
    df = pd.DataFrame(
        {
            "energy_kwh": spike_energies,
            "hour": [12] * 51,
            "is_weekend": [0] * 51,
            "timestamp": pd.date_range("2026-01-01", periods=51, freq="1h").strftime("%Y-%m-%d %H:%M:%S"),
        }
    )

    detector = ConsumptionAnomalyDetector(contamination=0.05)
    detector.fit(df)

    # Detect anomalies
    anomalies = detector.detect_anomalies(df, threshold=0.70)
    # The spike should be identified
    spike_detected = any(a["energy_kwh"] == 8.5 for a in anomalies)
    assert spike_detected
