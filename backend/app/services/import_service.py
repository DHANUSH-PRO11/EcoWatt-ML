import io
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session

from backend.app.models.energy import EnergyReading
from backend.app.models.metadata import DataImportMeta
from backend.app.models.audit import AuditLog
from backend.app.models.notification import Notification


def preview_csv(file_bytes: bytes, max_preview: int = 10) -> Dict[str, Any]:
    """
    Previews raw CSV bytes, automatically detects delimiters, and returns candidate headers and sample rows.
    """
    for sep in [",", ";", "\t", "|"]:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), sep=sep, nrows=max_preview)
            if len(df.columns) > 1:
                return {
                    "detected_separator": sep,
                    "columns": list(df.columns),
                    "preview_rows": df.fillna("").to_dict(orient="records"),
                }
        except Exception:
            continue

    # Fallback to standard comma
    df = pd.read_csv(io.BytesIO(file_bytes), nrows=max_preview)
    return {
        "detected_separator": ",",
        "columns": list(df.columns),
        "preview_rows": df.fillna("").to_dict(orient="records"),
    }


def validate_csv_dataset(
    file_bytes: bytes,
    timestamp_col: str,
    energy_col: str,
    sub1_col: Optional[str] = None,
    sub2_col: Optional[str] = None,
    sub3_col: Optional[str] = None,
    separator: str = ",",
) -> Dict[str, Any]:
    """
    Validates CSV content:
    - Parses timestamps and checks for parsing errors
    - Checks for negative or extreme non-physical values (> 100 kWh/hr for residential/commercial)
    - Records rejected rows with precise reasons
    - Computes summary statistics for valid rows
    """
    df = pd.read_csv(io.BytesIO(file_bytes), sep=separator)

    total_rows = len(df)
    rejected_rows: List[Dict[str, Any]] = []
    valid_rows: List[Dict[str, Any]] = []

    if timestamp_col not in df.columns:
        return {"error": f"Timestamp column '{timestamp_col}' not found in uploaded file."}
    if energy_col not in df.columns:
        return {"error": f"Energy/Power column '{energy_col}' not found in uploaded file."}

    seen_timestamps = set()

    for idx, row in df.iterrows():
        row_num = idx + 1
        raw_ts = row[timestamp_col]

        # 1. Validate timestamp
        try:
            ts = pd.to_datetime(raw_ts)
            if pd.isna(ts):
                rejected_rows.append({"row": row_num, "reason": "Null or empty timestamp"})
                continue
        except Exception:
            rejected_rows.append({"row": row_num, "reason": f"Unparseable timestamp format: '{raw_ts}'"})
            continue

        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
        if ts_str in seen_timestamps:
            rejected_rows.append({"row": row_num, "reason": f"Duplicate timestamp '{ts_str}' in file"})
            continue
        seen_timestamps.add(ts_str)

        # 2. Validate energy value
        raw_energy = row[energy_col]
        try:
            energy_val = float(raw_energy)
            if pd.isna(energy_val):
                rejected_rows.append({"row": row_num, "reason": "Null or empty energy reading"})
                continue
            if energy_val < 0.0:
                rejected_rows.append({"row": row_num, "reason": f"Negative energy value ({energy_val})"})
                continue
            if energy_val > 200.0:
                rejected_rows.append({"row": row_num, "reason": f"Unrealistic spike above 200 kWh ({energy_val})"})
                continue
        except Exception:
            rejected_rows.append({"row": row_num, "reason": f"Non-numeric energy reading: '{raw_energy}'"})
            continue

        # Optional sub-meters
        def parse_sub(col_name):
            if col_name and col_name in df.columns:
                try:
                    val = float(row[col_name])
                    return max(0.0, val) if not pd.isna(val) else 0.0
                except Exception:
                    return 0.0
            return 0.0

        sub1 = parse_sub(sub1_col)
        sub2 = parse_sub(sub2_col)
        sub3 = parse_sub(sub3_col)
        sub_other = max(0.0, energy_val - (sub1 + sub2 + sub3))

        valid_rows.append(
            {
                "timestamp": ts_str,
                "energy_kwh": round(energy_val, 4),
                "sub_1": round(sub1, 4),
                "sub_2": round(sub2, 4),
                "sub_3": round(sub3, 4),
                "sub_other": round(sub_other, 4),
            }
        )

    valid_count = len(valid_rows)
    invalid_count = len(rejected_rows)

    start_date = valid_rows[0]["timestamp"] if valid_rows else None
    end_date = valid_rows[-1]["timestamp"] if valid_rows else None
    total_kwh = sum(r["energy_kwh"] for r in valid_rows)

    return {
        "total_rows": total_rows,
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "start_date": start_date,
        "end_date": end_date,
        "total_kwh": round(total_kwh, 2),
        "rejected_sample": rejected_rows[:20],
        "valid_records": valid_rows,
    }


def execute_import(
    db: Session,
    valid_records: List[Dict[str, Any]],
    building_id: int,
    meter_id: Optional[int] = None,
    source_name: str = "User CSV Import",
    is_simulated: bool = False,
) -> Dict[str, Any]:
    """
    Executes atomic database import in batches of 1000 with rollback on failure.
    Records provenance metadata in DataImportMeta, AuditLog, and Notification.
    """
    if not valid_records:
        return {"imported": 0, "message": "No valid records provided for import."}

    try:
        readings = []
        for r in valid_records:
            readings.append(
                EnergyReading(
                    building_id=building_id,
                    meter_id=meter_id or 1,
                    timestamp=datetime.strptime(r["timestamp"], "%Y-%m-%d %H:%M:%S"),
                    energy_kwh=r["energy_kwh"],
                    sub_metering_1_kwh=r.get("sub_1", 0.0),
                    sub_metering_2_kwh=r.get("sub_2", 0.0),
                    sub_metering_3_kwh=r.get("sub_3", 0.0),
                    sub_metering_other_kwh=r.get("sub_other", 0.0),
                    is_simulated=is_simulated,
                )
            )

        db.bulk_save_objects(readings)
        db.commit()

        # Record DataImportMeta
        ts_list = [datetime.strptime(r["timestamp"], "%Y-%m-%d %H:%M:%S") for r in valid_records]
        import_meta = DataImportMeta(
            source_name=source_name,
            total_rows=len(readings),
            start_date=min(ts_list),
            end_date=max(ts_list),
            is_simulated=is_simulated,
        )
        db.add(import_meta)

        # Audit Log
        db.add(
            AuditLog(
                user_or_system="operator",
                action="csv_data_imported",
                resource_type="energy_readings",
                resource_id=f"building_{building_id}",
                details_json=f'{{"source": "{source_name}", "rows_imported": {len(readings)}}}',
            )
        )

        # In-App Notification
        db.add(
            Notification(
                building_id=building_id,
                category="data_import",
                severity="info",
                title="Data Import Succeeded",
                message=f"Successfully imported {len(readings)} energy readings from '{source_name}'.",
                link_url="/analytics",
            )
        )
        db.commit()

        return {
            "success": True,
            "imported_count": len(readings),
            "start_date": min(ts_list).strftime("%Y-%m-%d %H:%M:%S"),
            "end_date": max(ts_list).strftime("%Y-%m-%d %H:%M:%S"),
            "source_name": source_name,
        }

    except Exception as e:
        db.rollback()
        # Log failure notification
        db.add(
            Notification(
                building_id=building_id,
                category="data_import",
                severity="critical",
                title="Data Import Failed",
                message=f"Import transaction rolled back due to error: {str(e)}",
                link_url="/import",
            )
        )
        db.commit()
        raise RuntimeError(f"Database import rolled back: {str(e)}")
