# EcoWatt ML — Enterprise Energy Intelligence & Telemetry Analytics Platform

![EcoWatt ML Banner](https://img.shields.io/badge/EcoWatt%20ML-Enterprise%20Edition-10B981?style=for-the-badge&logo=lightning&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)
![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-1.4+-F7931E?style=flat-square&logo=scikit-learn&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4+-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-36%20Passed-4EAA25?style=flat-square&logo=pytest&logoColor=white)

**EcoWatt ML** is an end-to-end, production-grade machine learning platform for facility and residential electricity telemetry. It unifies multi-building portfolio management, recursive time-series forecasting with permutation explainability, statistical prediction interval calibration, automated model drift monitoring with safe candidate rollback, interactive what-if energy scenario simulation, tiered budget tracking, sub-metered circuit analytics, deep anomaly lifecycle investigations, and verifiable carbon accounting.

---

## 1. Upgraded Feature Modules (Features 1–13)

### 🏢 Feature 1: Multi-Building & Multi-Meter Portfolio Management
- **Hierarchical Asset Hierarchy**: Support for `household`, `classroom`, `laboratory`, `office`, and `commercial` facilities with address, floor area ($m^2$), and active meter mapping.
- **Portfolio Normalization**: Normalized energy intensity metrics ($\text{kWh} / m^2$) across portfolio assets to benchmark structural energy efficiency.
- **Backward-Compatible Isolation**: Global building filters dynamically propagate across dashboards, telemetry, forecasts, anomalies, budgets, and bills while defaulting gracefully to single-facility mode.

### 🔍 Feature 2: Forecast Explainability & Calibrated Intervals
- **Multi-Model Overlay**: Forecast responses concurrently present actual historical readings, candidate model recursive trajectories ($H=1$ to $H=168$), and a seasonal baseline forecaster.
- **Permutation Explainability**: Top 5 predictive sensitivity drivers (`lag_1`, `rolling_mean_24`, `hour_sin`, etc.) with statistical disclaimers explicitly differentiating predictive variance from physical appliance causation.
- **Empirical Coverage Validation**: Verifies prediction interval validity against held-out residuals; includes confidence horizon multipliers ($\sqrt{1 + 0.04(h - 1)}$) modeling expanding temporal uncertainty.

### 🛡️ Feature 3: Model Drift & Safe Retraining Engine
- **Statistical Drift Detection**: Monitors 168-hour rolling MAE and RMSE against initial validation benchmarks ($\text{threshold} \times 1.40$) and consumption distribution shifts.
- **Tri-State Health Classification**: Real-time diagnostic states (`Healthy`, `Warning`, `Drift Detected`).
- **Safe Rollback Quality Gate**: Retraining trains candidate architectures against fresh telemetry. If candidate validation MAE degrades by $>25\%$, the candidate is rejected, previous `.bak` model weights are restored, and audit history captures the failure reason without breaking production traffic.

### 💳 Feature 4: Energy Budget Planning & Cost Projections
- **Configurable Monthly Budgets**: Per-building spending limits in configurable local currency (`USD`, `EUR`, `GBP`, `INR`, etc.).
- **Prorated Forecast Trajectory**: Combines Month-to-Date (MTD) actual billing with remaining-cycle recursive model forecasts.
- **Automated Threshold Warnings**: Early alert triggers at 80%, 90%, and 100% of budgeted threshold with projected overspend calculations.

### 🔌 Feature 5: Appliance & Circuit-Level Analytics
- **Sub-Metering Disaggregation**: Sub-metering telemetry partitioned into Kitchen, Laundry, HVAC/Water Heating, and Other measured circuits.
- **Simulated vs. Measured Provenance**: Sub-circuits are labeled as `measured` or `simulated` to prevent misleading causal claims.
- **Peak Draw Identification**: Computes peak consumption hours and relative circuit contribution percentages.

### 🚨 Feature 6: Advanced Anomaly Investigation & Feedback
- **Deep Historical Context**: Anomaly investigation modal visualizes $\pm 24$-hour surrounding telemetry overlaid with the building's historical mean for that specific day and hour.
- **Statistical Attribution**: Discloses isolation forest outlier score, expected baseline, standard deviation deviation, and non-accusatory disclaimers.
- **False-Positive Feedback Loop**: Operators can acknowledge, resolve, or mark alerts as false-positives with investigator notes and audit logs.
- **Deduplication Engine**: Prevents identical anomaly alerts for the same timestamp and detector version.

### ⚡ Feature 7: Interactive What-If Energy Simulator
- **Non-Destructive Simulation**: Test conservation interventions (general % reduction, peak load shifting 17:00–21:00, weekend conservation, or daily consumption targets).
- **Dual-Curve Visualization**: Side-by-side comparison of baseline vs. simulated 24-hour demand curves.
- **Financial & Environmental Payoff**: Projections of monthly/annual kWh saved, cost avoided, and CO2 emissions eliminated.

### 🌿 Feature 8: Carbon Emissions Analytics
- **Configurable Grid Emission Factors**: Customizable carbon intensity ($kg\text{ CO}_2\text{e} / \text{kWh}$) referencing local power grid sources (e.g., US EPA eGRID, UK DEFRA).
- **Actual vs. Forecast Carbon Accounting**: Aggregates facility carbon footprints across customizable time ranges with avoided emissions calculations.

### 🔔 Feature 9: Smart Notification & Alert Center
- **In-App Notification Feed**: Centralized notifications for consumption spikes, budget thresholds, model drift warnings, and retraining triggers.
- **Lifecycle & Deduplication**: Unread counter badges, timestamped severities (`info`, `warning`, `critical`), and deduplication preventing notification spam.

### 📥 Feature 10: Data Quality & Import Center
- **Pre-Import Verification**: CSV delimiter sniffing, column preview, and required column mapping (`timestamp`, `global_active_power` or `consumption_kwh`).
- **Atomic Quality Validation**: Comprehensive checks for negative consumption, extreme spike filtering ($>15 \text{ kW}$), timestamp duplicate detection, and chronological sorting.
- **Safe Rollback**: Transactions are committed atomically; failures roll back completely without corrupting the operational database.

### 📊 Feature 11: Advanced Analytics & Comparisons
- **Period-over-Period Benchmarks**: Day-over-Day (DoD), Week-over-Week (WoW), and Month-over-Month (MoM) consumption deltas.
- **24×7 Demand Heatmap**: Hour-of-day vs. Day-of-week consumption intensity matrix for thermal and operational scheduling.

### 📄 Feature 12: Downloadable Reports & Exports
- **Multi-Format Streaming**: Direct CSV exports for raw energy telemetry, multi-step forecasts, and anomaly audit logs.
- **Executive Summary Generation**: Automated markdown and structured summaries capturing model versions, total energy, spend, and peak demand.

### 🔒 Feature 13: Security & Audit Logging
- **Configurable CORS & Request Limits**: Secure origin whitelisting and 10MB payload guards on file uploads.
- **Audit Trail**: Persistent `AuditLog` recording building updates, tariff alterations, model retraining invocations, and anomaly resolutions.

---

## 2. System Architecture

```text
EcoWatt-ML/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application & router mounting
│   │   ├── config.py                   # Pydantic Settings & environment config
│   │   ├── database.py                 # SQLAlchemy 2.0 engine & session factory
│   │   ├── migration.py                # Non-destructive SQLite schema migrator
│   │   ├── seed.py                     # Database initialization & benchmark seeding
│   │   ├── models/                     # SQLAlchemy Entities
│   │   │   ├── building.py             # Building & EnergyMeter entities
│   │   │   ├── budget.py               # BudgetSetting entity
│   │   │   ├── notification.py         # Notification entity
│   │   │   ├── audit.py                # AuditLog entity
│   │   │   ├── carbon.py               # CarbonSetting entity
│   │   │   ├── training.py             # ModelTrainingRecord entity
│   │   │   ├── energy.py               # EnergyReading entity
│   │   │   ├── anomaly.py              # AnomalyAlert entity
│   │   │   └── tariff.py               # TariffSetting entity
│   │   ├── schemas/                    # Pydantic v2 validation contracts
│   │   ├── services/                   # Modular Domain Services
│   │   │   ├── building_service.py     # Multi-building & portfolio intensity
│   │   │   ├── forecast_service.py     # Explainability, baseline & intervals
│   │   │   ├── model_health_service.py # Drift detector & safe retraining
│   │   │   ├── budget_service.py       # Cost projection & threshold alerts
│   │   │   ├── simulator_service.py    # What-if scenario calculations
│   │   │   ├── carbon_service.py       # Emissions & grid factor tracking
│   │   │   ├── circuit_service.py      # Sub-metering circuit analysis
│   │   │   ├── notification_service.py # In-app notification engine
│   │   │   ├── import_service.py       # CSV validation & atomic commit
│   │   │   └── report_service.py       # CSV streaming & executive summaries
│   │   └── api/                        # REST Controllers
├── ml/
│   ├── dataset.py                      # UCI ingestion & realistic benchmark generator
│   ├── feature_engineering.py          # Cyclical encodings, non-leaking lags & rolling windows
│   ├── models.py                       # Regression models & metrics
│   ├── train.py                        # Chronological training & model competition
│   ├── forecast.py                     # Recursive multi-step forecaster
│   ├── anomaly.py                      # Isolation Forest anomaly detector
│   └── saved_models/                   # Persisted Joblib models & metadata
├── frontend/
│   ├── src/
│   │   ├── api/client.js               # Centralized Axios API client
│   │   ├── components/                 # Navbar, MetricCard, StatusBadge, Spinner
│   │   └── pages/                      # 10 Modern Dark-Navy Pages
│   │       ├── Dashboard.jsx           # Portfolio overview & executive actions
│   │       ├── BuildingManagement.jsx  # Multi-building & meter CRUD
│   │       ├── EnergyAnalytics.jsx     # Telemetry, comparisons, circuits & heatmap
│   │       ├── Forecasting.jsx         # Explainable forecasts & confidence bounds
│   │       ├── AnomalyMonitoring.jsx   # Anomaly lifecycle & deep investigation modal
│   │       ├── BillEstimator.jsx       # Tiered slab calculator & monthly budget
│   │       ├── EnergySimulator.jsx     # Interactive what-if scenario testing
│   │       ├── ModelHealth.jsx         # Drift metrics & safe model retraining
│   │       ├── DataImportCenter.jsx    # CSV upload, preview & validation report
│   │       └── NotificationsCenter.jsx # Real-time alerts & notification feed
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── tests/                              # Pytest test suite (36 automated tests)
```

---

## 3. Database Schema & Migration Strategy

EcoWatt ML uses a non-destructive automatic migration runner (`backend/app/migration.py`). On application startup:
1. `PRAGMA table_info(...)` inspects existing SQLite tables.
2. Missing columns (`building_id`, `meter_id`, `investigation_notes`, `resolved_by`, `is_false_positive`) are added via safe `ALTER TABLE ... ADD COLUMN` statements.
3. Historical rows with null associations are backfilled automatically to **Building #1 (Main Facility)** and **Meter #1 (Main Grid Meter)** without data loss.
4. Composite indexes are created for fast time-series filtering on `(building_id, timestamp)` and `(meter_id, timestamp)`.

---

## 4. API Endpoints Reference

| Module | Method | Endpoint | Description |
| :--- | :---: | :--- | :--- |
| **System** | `GET` | `/health` | Service health status & database connectivity |
| **Buildings** | `GET` | `/api/buildings` | List all registered buildings |
| | `POST` | `/api/buildings` | Register a new building facility |
| | `GET` | `/api/buildings/portfolio/summary` | Portfolio summary & energy intensity ($kWh/m^2$) |
| | `POST` | `/api/buildings/{id}/meters` | Register a meter for a building |
| **Forecasts** | `GET` | `/api/forecast` | Recursive forecasts with explainability & intervals |
| **Model Health** | `GET` | `/api/model/health` | Model drift metrics, rolling error & health status |
| | `POST` | `/api/model/retrain` | Trigger safe model retraining with rollback guard |
| | `GET` | `/api/model/history` | Historical model training run records |
| **Budgets** | `GET` | `/api/budget` | Current monthly budget status & overspend projections |
| | `POST` | `/api/budget` | Update monthly budget limit & alert thresholds |
| **Simulator** | `POST` | `/api/simulator/simulate` | Run non-destructive what-if energy intervention |
| **Carbon** | `GET` | `/api/carbon/summary` | Carbon emissions summary & grid factor |
| | `POST` | `/api/carbon/settings` | Update grid carbon intensity factor |
| **Circuits** | `GET` | `/api/circuits/breakdown` | Sub-metered circuit breakdown (Kitchen, HVAC, etc.) |
| **Anomalies** | `GET` | `/api/anomalies` | List anomaly alerts with building/meter filters |
| | `GET` | `/api/anomalies/{id}/investigate` | $\pm 24$-hour surrounding telemetry investigation |
| | `PATCH` | `/api/anomalies/{id}` | Update status, resolve, or mark false-positive |
| **Notifications**| `GET` | `/api/notifications` | Unread and historical notifications feed |
| | `PATCH` | `/api/notifications/{id}/read` | Mark individual notification as read |
| | `POST` | `/api/notifications/read-all` | Mark all notifications as read |
| **Data Import** | `POST` | `/api/import/preview` | Preview CSV headers and delimiter |
| | `POST` | `/api/import/upload` | Validate and atomically import CSV telemetry |
| **Reports** | `GET` | `/api/reports/csv` | Stream CSV export for energy, forecasts, or anomalies |
| | `GET` | `/api/reports/executive-summary`| Generate structured executive energy report |

---

## 5. Quickstart & Local Execution

### Prerequisites
- Python 3.10+ (tested with Python 3.11 & 3.14)
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Train baseline models and save artifacts
python -m ml.train --force-sample

# 3. Initialize SQLite database, execute migrations, and seed sample assets
python -m backend.app.seed

# 4. Start FastAPI server
uvicorn backend.app.main:app --reload --port 8000
```
Backend will be live at `http://localhost:8000`. OpenAPI documentation available at `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Automated Test Suite (36 Tests)

Run the full automated test suite verifying all 13 enterprise features:
```bash
python -m pytest tests -v
```

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
tests/test_budget_simulator_carbon.py::test_budget_service_projection PASSED
tests/test_budget_simulator_carbon.py::test_simulator_service_reduction PASSED
tests/test_budget_simulator_carbon.py::test_carbon_service_emissions PASSED
tests/test_budget_simulator_carbon.py::test_circuit_breakdown PASSED
tests/test_buildings.py::test_create_building_and_meter PASSED
tests/test_buildings.py::test_portfolio_summary PASSED
tests/test_buildings.py::test_building_filtering_on_energy PASSED
tests/test_features.py::test_calendar_features PASSED
tests/test_features.py::test_no_target_leakage_in_lags_and_rolling PASSED
tests/test_forecast_explainability.py::test_forecast_explainability_and_baseline PASSED
tests/test_forecast_explainability.py::test_prediction_interval_coverage_check PASSED
tests/test_import_reports_notifications.py::test_csv_import_validation_and_rollback PASSED
tests/test_import_reports_notifications.py::test_notification_creation_and_read PASSED
tests/test_import_reports_notifications.py::test_anomaly_investigation_and_notes PASSED
tests/test_import_reports_notifications.py::test_report_csv_generation PASSED
tests/test_import_reports_notifications.py::test_executive_summary_report PASSED
tests/test_model_health.py::test_drift_metrics_computation PASSED
tests/test_model_health.py::test_safe_retraining_and_rollback PASSED
tests/test_models.py::test_evaluation_metrics_exact PASSED
tests/test_models.py::test_baseline_forecaster PASSED
tests/test_models.py::test_model_pipeline_factory PASSED

======================== 36 passed in 4.43s ========================
```

---

## 7. Known Limitations & Recommended Enhancements

1. **Storage Engine**: SQLite is utilized for single-node deployments. For multi-tenant high-throughput IoT ingestion (>10,000 meters), migrating the storage layer to PostgreSQL with TimescaleDB or InfluxDB is recommended.
2. **Explainability Method**: Permutation sensitivity is currently pre-computed and dynamically matched. Implementing real-time TreeSHAP on tree ensembles would yield individual per-horizon step attribution.
3. **Authentication**: Role-based access control (RBAC) hooks and audit log schemas are implemented. For enterprise enterprise deployments, integrating OAuth2/OIDC (Keycloak/Auth0) into `backend/app/main.py` is recommended.

---

## 8. License

Distributed under the MIT License. Built for energy efficiency research, industrial facility management, and intelligent IoT telemetry analytics.
