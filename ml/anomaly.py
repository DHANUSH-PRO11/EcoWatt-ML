import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional, Tuple
from sklearn.ensemble import IsolationForest
import joblib

from ml.config import ISOLATION_FOREST_FILE, DEFAULT_CONTAMINATION


class ConsumptionAnomalyDetector:
    """
    Isolation Forest-based anomaly detector for residential electricity consumption.
    Detects abnormal spikes, unexpected overnight baseload inflation, and irregular patterns.
    """

    def __init__(self, contamination: float = DEFAULT_CONTAMINATION, random_state: int = 42):
        self.contamination = contamination
        self.random_state = random_state
        self.model = IsolationForest(
            contamination=self.contamination,
            random_state=self.random_state,
            n_estimators=120,
            max_samples="auto",
        )
        self.is_fitted = False
        self.min_raw_score = 0.0
        self.max_raw_score = 1.0

    def _extract_anomaly_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Extract descriptive features for anomaly detection:
        - Absolute energy consumption
        - Deviation ratio from 24h rolling average
        - Hour of the day (for recognizing diurnal context)
        - Weekend indicator
        """
        feats = pd.DataFrame(index=df.index)
        feats["energy_kwh"] = df["energy_kwh"].values

        # Rolling baseline approximation
        if "rolling_mean_24" in df.columns:
            rolling_base = df["rolling_mean_24"].values
        else:
            rolling_base = df["energy_kwh"].rolling(window=24, min_periods=1).mean().values

        safe_base = np.maximum(rolling_base, 0.1)
        feats["residual_ratio"] = (feats["energy_kwh"] - safe_base) / safe_base

        if "hour" in df.columns:
            feats["hour"] = df["hour"].values
        elif "timestamp" in df.columns:
            feats["hour"] = pd.to_datetime(df["timestamp"]).dt.hour.values
        else:
            feats["hour"] = 12

        if "is_weekend" in df.columns:
            feats["is_weekend"] = df["is_weekend"].values
        elif "timestamp" in df.columns:
            feats["is_weekend"] = (pd.to_datetime(df["timestamp"]).dt.dayofweek >= 5).astype(int).values
        else:
            feats["is_weekend"] = 0

        return feats[["energy_kwh", "residual_ratio", "hour", "is_weekend"]].fillna(0.0)

    def fit(self, df: pd.DataFrame):
        """Fit Isolation Forest on historical consumption dataframe."""
        X = self._extract_anomaly_features(df)
        self.model.fit(X)
        self.is_fitted = True

        # Compute calibration range on training data
        raw_scores = -self.model.decision_function(X)
        self.min_raw_score = float(np.percentile(raw_scores, 1))
        self.max_raw_score = float(np.percentile(raw_scores, 99))
        if self.max_raw_score <= self.min_raw_score:
            self.max_raw_score = self.min_raw_score + 1.0
        return self

    def score_samples(self, df: pd.DataFrame) -> np.ndarray:
        """
        Returns normalized anomaly score between 0.0 (perfectly normal) and 1.0 (extreme anomaly).
        """
        if not self.is_fitted:
            raise RuntimeError("Anomaly detector must be fitted before scoring.")

        X = self._extract_anomaly_features(df)
        raw_scores = -self.model.decision_function(X)

        # Scale into 0 to 1 range
        normalized = (raw_scores - self.min_raw_score) / (self.max_raw_score - self.min_raw_score)
        return np.clip(normalized, 0.0, 1.0)

    def classify_severity(self, score: float, energy: float, baseline: float) -> str:
        """Classify anomaly severity based on normalized score and relative deviation."""
        ratio = (energy / max(baseline, 0.1)) if baseline > 0 else 1.0

        if score >= 0.90 or ratio >= 3.8:
            return "critical"
        elif score >= 0.82 or ratio >= 2.6:
            return "high"
        elif score >= 0.72 or ratio >= 1.9:
            return "medium"
        else:
            return "low"

    def detect_anomalies(
        self,
        df: pd.DataFrame,
        threshold: float = 0.70,
    ) -> List[Dict[str, Any]]:
        """
        Detect anomalies across DataFrame. Returns structured anomaly alerts list.
        """
        if not self.is_fitted:
            raise RuntimeError("Detector is not fitted.")

        scores = self.score_samples(df)
        anomalies = []

        timestamps = df["timestamp"].values if "timestamp" in df.columns else [str(i) for i in df.index]
        energies = df["energy_kwh"].values

        if "rolling_mean_24" in df.columns:
            baselines = df["rolling_mean_24"].values
        else:
            baselines = df["energy_kwh"].rolling(window=24, min_periods=1).mean().values

        for i, score in enumerate(scores):
            if score >= threshold:
                energy = float(energies[i])
                base = float(baselines[i])
                severity = self.classify_severity(score, energy, base)
                diff_pct = round(((energy - base) / max(base, 0.1)) * 100, 1)

                anomalies.append(
                    {
                        "timestamp": str(timestamps[i]),
                        "energy_kwh": round(energy, 3),
                        "baseline_kwh": round(base, 3),
                        "deviation_pct": diff_pct,
                        "anomaly_score": round(float(score), 3),
                        "severity": severity,
                        "status": "new",
                        "explanation": (
                            f"Consumption of {round(energy, 2)} kWh is {abs(diff_pct)}% "
                            f"{'above' if diff_pct > 0 else 'below'} the 24h baseline of {round(base, 2)} kWh. "
                            f"Note: This alert reflects statistical anomaly detection, not direct verification of electrical damage or fault."
                        ),
                    }
                )

        return anomalies

    def save(self, filepath=ISOLATION_FOREST_FILE):
        joblib.dump(self, filepath)

    @classmethod
    def load(cls, filepath=ISOLATION_FOREST_FILE) -> "ConsumptionAnomalyDetector":
        return joblib.load(filepath)
