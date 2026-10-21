from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODEL_DIR = BASE_DIR / "ml" / "saved_models"

# Ensure directories exist
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)

# Processed file paths
HOURLY_DATA_FILE = PROCESSED_DATA_DIR / "hourly_consumption.csv"
DAILY_DATA_FILE = PROCESSED_DATA_DIR / "daily_consumption.csv"

# Model artifact paths
BEST_MODEL_FILE = MODEL_DIR / "best_forecaster.joblib"
BASELINE_MODEL_FILE = MODEL_DIR / "baseline_model.joblib"
ISOLATION_FOREST_FILE = MODEL_DIR / "isolation_forest.joblib"
METRICS_FILE = MODEL_DIR / "evaluation_metrics.json"

# Feature configuration
TARGET_COL = "energy_kwh"
DATETIME_COL = "timestamp"

# Lag hours to create (must not look ahead)
LAG_HOURS = [1, 2, 3, 24, 48, 168]

# Rolling window sizes (hours)
ROLLING_WINDOWS = [6, 24]

# Chronological split ratios
TRAIN_RATIO = 0.70
VAL_RATIO = 0.15
TEST_RATIO = 0.15

# Anomaly detection settings
DEFAULT_CONTAMINATION = 0.03
ANOMALY_FEATURE_COLS = ["energy_kwh", "residual_ratio", "hour", "is_weekend"]
