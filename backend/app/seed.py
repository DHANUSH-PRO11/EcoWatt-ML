import os
import json
from pathlib import Path
from datetime import datetime, timezone
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.database import engine, Base, SessionLocal
from backend.app.models.energy import EnergyReading
from backend.app.models.anomaly import AnomalyAlert
from backend.app.models.tariff import TariffSetting
from backend.app.models.metadata import ModelEvaluationMeta, DataImportMeta
from backend.app.services.tariff_service import get_or_create_active_tariff
from backend.app.services.anomaly_service import scan_and_store_anomalies
from ml.config import HOURLY_DATA_FILE, METRICS_FILE
from ml.dataset import get_or_load_dataset


def init_db():
    """Create all database tables."""
    print("Creating database schema...")
    Base.metadata.create_all(bind=engine)


def seed_database():
    """Seed SQLite database with processed energy readings, default tariff, and anomaly alerts."""
    init_db()
    db: Session = SessionLocal()

    try:
        # 1. Check if EnergyReading is already populated
        existing_count = db.query(EnergyReading).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} energy readings. Skipping bulk import.")
        else:
            print("Importing energy readings from processed data file...")
            df = get_or_load_dataset()
            df["timestamp"] = pd.to_datetime(df["timestamp"])

            # Bulk insert in batches of 1000
            readings = []
            for _, row in df.iterrows():
                readings.append(
                    EnergyReading(
                        timestamp=row["timestamp"].to_pydatetime(),
                        energy_kwh=float(row["energy_kwh"]),
                        reactive_power_kvar=float(row.get("reactive_power_kvar", 0.0)),
                        voltage=float(row.get("voltage", 230.0)),
                        global_intensity=float(row.get("global_intensity", 5.0)),
                        sub_metering_1_kwh=float(row.get("sub_metering_1_kwh", 0.0)),
                        sub_metering_2_kwh=float(row.get("sub_metering_2_kwh", 0.0)),
                        sub_metering_3_kwh=float(row.get("sub_metering_3_kwh", 0.0)),
                        sub_metering_other_kwh=float(row.get("sub_metering_other_kwh", 0.0)),
                        is_simulated=bool(row.get("is_simulated", True)),
                    )
                )

            db.bulk_save_objects(readings)
            db.commit()
            print(f"Successfully inserted {len(readings)} energy readings into database.")

            # Record Data Import Metadata
            is_sim = bool(df["is_simulated"].iloc[0])
            import_meta = DataImportMeta(
                source_name="Realistic Household Consumption Benchmark (Simulated)" if is_sim else "UCI Household Electric Power Dataset",
                total_rows=len(df),
                start_date=df["timestamp"].min().to_pydatetime(),
                end_date=df["timestamp"].max().to_pydatetime(),
                is_simulated=is_sim,
            )
            db.add(import_meta)
            db.commit()

        # 2. Seed active Tariff
        get_or_create_active_tariff(db)
        print("Active tariff verified/seeded.")

        # 3. Seed Model Evaluation Metadata
        if METRICS_FILE.exists():
            with open(METRICS_FILE, "r") as f:
                metrics_data = json.load(f)

            existing_meta = db.query(ModelEvaluationMeta).filter(ModelEvaluationMeta.is_active == True).first()
            if not existing_meta:
                best_name = metrics_data["best_model_name"]
                best_val = metrics_data["validation_metrics"][best_name]
                best_test = metrics_data["test_metrics"][best_name]
                meta_record = ModelEvaluationMeta(
                    trained_at=datetime.fromisoformat(metrics_data["trained_at"].replace("Z", "+00:00")),
                    best_model_name=best_name,
                    dataset_rows=metrics_data["dataset_rows"],
                    val_mae=best_val["mae"],
                    val_rmse=best_val["rmse"],
                    val_r2=best_val["r2"],
                    test_mae=best_test["mae"],
                    test_rmse=best_test["rmse"],
                    test_r2=best_test["r2"],
                    residual_std=metrics_data["residual_std"],
                    all_metrics_json=json.dumps(metrics_data),
                    is_active=True,
                )
                db.add(meta_record)
                db.commit()
                print("Model evaluation metadata recorded.")

        # 4. Scan and Seed Anomaly Alerts
        anom_count = db.query(AnomalyAlert).count()
        if anom_count == 0:
            print("Scanning energy readings for anomalies with Isolation Forest...")
            new_anoms = scan_and_store_anomalies(db, threshold=0.70)
            print(f"Detected and recorded {new_anoms} initial anomaly alerts.")
        else:
            print(f"Database contains {anom_count} anomaly alerts.")

        print("Database initialization & seeding complete!")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
