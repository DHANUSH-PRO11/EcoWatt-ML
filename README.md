# EcoWatt ML — Smart Household Electricity Consumption Prediction Platform

![EcoWatt ML Banner](https://img.shields.io/badge/EcoWatt%20ML-Production%20Ready-10B981?style=for-the-badge&logo=lightning&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)
![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4+-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-20%20Passed-4EAA25?style=flat-square&logo=pytest&logoColor=white)

**EcoWatt ML** is an end-to-end, production-minded machine learning platform for residential electricity telemetry. It analyzes power consumption, forecasts future energy demand across multi-step horizons, detects unusual consumption anomalies using Isolation Forests, simulates electricity bills across tiered tariff structures, and generates evidence-based energy efficiency recommendations backed strictly by measured telemetry.

---

## 1. Key Features

- **Real Machine Learning Pipeline**: Evaluates four candidate regression architectures (Historical Baseline, Scaled Linear Regression, Random Forest Regressor, HistGradientBoostingRegressor) on strict chronological train/validation/test splits.
- **Leak-Free Time-Series Engineering**: Calendar cyclical encodings, lagged consumption observations ($\text{lag}_1, \text{lag}_2, \text{lag}_3, \text{lag}_{24}, \text{lag}_{48}, \text{lag}_{168}$), and rolling window statistics shifted to guarantee zero lookahead bias.
- **Recursive Multi-Step Forecasting**: Next-hour ($H=1$), next-day ($H=24$), and next-7-day ($H=168$) recursive forecasting that dynamically updates lagged buffers and computes calibrated prediction intervals ($\pm z \cdot \sigma_{\text{residual}} \cdot \sqrt{1 + 0.04(h - 1)}$).
- **Isolation Forest Anomaly Detection**: Unsupervised outlier scoring across consumption and baseline deviation, categorized into `Low`, `Medium`, `High`, and `Critical` severities with full acknowledgement and resolution lifecycle tracking.
- **Configurable Tiered Bill Estimator**: Mathematical tiered slab calculation modeling incremental kWh cost brackets, pro-rated monthly fixed meter charges, local taxes, and grid surcharges.
- **Evidence-Based Energy Insights**: Rule-based heuristics evaluating actual measured telemetry (overnight baseload audits, evening peak load shifting, weekend surges, and appliance burst mitigation) with calculated monetary savings.
- **Dark-First Modern UI**: Built with React, Vite, Tailwind CSS, Recharts, and Lucide React. Designed with charcoal surfaces (`#0B0F17`), emerald green accents (`#10B981`), electric blue secondary series (`#0EA5E9`), and accessible contrast.

---

## 2. System Architecture

```text
EcoWatt-ML/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application & lifespan setup
│   │   ├── config.py            # Pydantic environment configuration
│   │   ├── database.py          # SQLAlchemy 2.0 engine & session
│   │   ├── seed.py              # Database initialization & seeding
│   │   ├── models/              # Energy, Forecast, Anomaly, Tariff, Metadata
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── services/            # Business logic (Energy, Forecasting, Anomaly, Billing, Insights)
│   │   └── api/                 # Documented REST API route controllers
├── ml/
│   ├── dataset.py               # UCI ingestion & realistic sample benchmark generator
│   ├── feature_engineering.py   # Calendar encodings, non-leaking lags & rolling windows
│   ├── models.py                # Model implementations & MAE/RMSE/R² metrics
│   ├── train.py                 # Chronological splits, model competition, & Joblib persistence
│   ├── forecast.py              # Recursive multi-step forecaster & prediction intervals
│   ├── anomaly.py               # Isolation Forest anomaly detector & scoring
│   └── saved_models/            # Joblib model artifacts & evaluation_metrics.json
├── frontend/
│   ├── src/
│   │   ├── api/client.js        # Axios API client
│   │   ├── components/          # Navbar, MetricCard, StatusBadge, EmptyState, Spinner
│   │   └── pages/               # 7 Functional Pages (Dashboard, Analytics, Forecasting, etc.)
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── tests/                       # Pytest test suite (20 unit & integration tests)
├── data/                        # Raw and processed CSV datasets
├── Dockerfile.backend           # Backend container image
├── Dockerfile.frontend          # Multi-stage frontend container image with Nginx
├── docker-compose.yml           # Multi-container orchestration
└── requirements.txt             # Python backend dependencies
```

---

## 3. Dataset & Power-to-Energy Methodology

### Official UCI Household Electricity Dataset
- **Repository**: [UCI Machine Learning Repository #235](https://archive.ics.uci.edu/dataset/235/individual+household+electric+power+consumption)
- **Placement**: Download archive, extract `household_power_consumption.txt`, and place into `data/raw/household_power_consumption.txt`.
- **Ingestion Command**:
  ```bash
  python -m ml.dataset --raw-path data/raw/household_power_consumption.txt
  ```

### Power (kW) vs. Energy (kWh) Conversion
The UCI dataset records minute-averaged active power in **kilowatts (kW)**.
1. Active energy consumed in one minute:
   $$E_{\text{minute}} = P_{\text{kW}} \times \frac{1}{60} \text{ h}$$
2. Over one full hour (60 minutes):
   $$E_{\text{hour}} (\text{kWh}) = \sum_{m=1}^{60} \left( P_{m} \times \frac{1}{60} \right) = \overline{P_{\text{hour}}} \times 1 \text{ hour}$$
   Therefore, the mean active power in kW over 60 minutes is numerically equivalent to the hourly energy consumption in **kWh**.
3. **Sub-metering conversion**:
   Raw sub-metering values are in Watt-hours (Wh). For an hourly aggregation:
   $$E_{\text{sub\_kwh}} = \frac{\sum_{m=1}^{60} \text{Sub\_metering}_m}{1000} \text{ kWh}$$
4. **Sub-metering remainder (Other household circuits)**:
   $$E_{\text{sub\_other}} = E_{\text{hour}} - (E_{\text{sub\_1}} + E_{\text{sub\_2}} + E_{\text{sub\_3}})$$

### Reproducible Sample Generator
When the multi-hundred megabyte raw UCI file is not present, EcoWatt ML automatically generates a realistic 180-day hourly household benchmark modeling diurnal morning/evening peaks, weekend load shifts, seasonal factors, submetering distributions, and noise (`is_simulated = True`).

---

## 4. Machine Learning Pipeline & Benchmark Results

The pipeline splits data chronologically (70% train, 15% validation, 15% test) with strictly zero random shuffling:

| Candidate Model | Algorithm Type | Val MAE | Val RMSE | Val R² | Test MAE | Test RMSE | Test R² |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Historical Baseline** | Day-of-Week & Hour Average | **0.3018** | 0.8677 | 0.2060 | 0.3282 | 0.8349 | 0.2671 |
| **Random Forest** | Ensemble Decision Trees (100 trees) | 0.3182 | 0.8622 | 0.2160 | **0.3163** | **0.8156** | **0.3005** |
| **HistGradientBoosting** | Histogram Boosted Trees | 0.3321 | 0.8755 | 0.1917 | 0.3549 | 0.8298 | 0.2759 |
| **Linear Regression** | Scaled Linear Model | 0.3879 | 0.8878 | 0.1689 | 0.4029 | 0.8673 | 0.2090 |

*Model selection is governed strictly by the lowest validation MAE to prevent test set data contamination.*

---

## 5. Quickstart & Local Installation

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Clone & Setup Backend
```bash
# Install Python requirements
pip install -r requirements.txt

# Run dataset preprocessing and train models
python -m ml.train --force-sample

# Initialize SQLite database and seed initial data
python -m backend.app.seed

# Start FastAPI backend server
uvicorn backend.app.main:app --reload --port 8000
```
Backend API will be accessible at `http://localhost:8000` with interactive OpenAPI docs at `http://localhost:8000/docs`.

### 2. Setup & Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Docker Deployment

Launch the full stack with Docker Compose:
```bash
docker-compose up --build
```
- Frontend: `http://localhost`
- Backend API: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`

---

## 7. Automated Test Suite

Run the full Pytest suite (20 automated tests covering feature engineering, non-leakage, slab calculations, models, and FastAPI routes):
```bash
python -m pytest tests -v
```

Output:
```text
tests/test_anomalies.py::test_anomaly_detector_fit_and_score PASSED
tests/test_anomalies.py::test_extreme_spike_detection PASSED
tests/test_api.py::test_health_endpoint PASSED
tests/test_api.py::test_dashboard_summary PASSED
tests/test_api.py::test_energy_history PASSED
tests/test_api.py::test_energy_analytics PASSED
tests/test_api.py::test_bill_estimate PASSED
tests/test_api.py::test_insights PASSED
tests/test_api.py::test_anomalies_list PASSED
tests/test_api.py::test_tariff_get_and_put PASSED
tests/test_billing.py::test_zero_consumption_bill PASSED
tests/test_billing.py::test_tier_1_boundary PASSED
tests/test_billing.py::test_tier_2_consumption PASSED
tests/test_billing.py::test_tier_3_boundary PASSED
tests/test_billing.py::test_unbounded_top_tier PASSED
tests/test_features.py::test_calendar_features PASSED
tests/test_features.py::test_no_target_leakage_in_lags_and_rolling PASSED
tests/test_models.py::test_evaluation_metrics_exact PASSED
tests/test_models.py::test_baseline_forecaster PASSED
tests/test_models.py::test_model_pipeline_factory PASSED

======================= 20 passed in 3.28s =======================
```

---

## 8. License

Distributed under the MIT License. Built for energy efficiency research and intelligent household telemetry analytics.
