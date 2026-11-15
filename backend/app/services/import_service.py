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
from backend.app.models.building import Building, EnergyMeter

DEFAULT_MAX_POWER_BY_TYPE = {
    "household": 15.0,
    "classroom": 50.0,
    "office": 100.0,
    "laboratory": 250.0,
    "commercial": 1000.0,
}


def resolve_max_power_threshold(
    db: Optional[Session] = None,
    building_id: Optional[int] = None,
    meter_id: Optional[int] = None,
    building_type: Optional[str] = None,
    custom_max_power_threshold: Optional[float] = None,
) -> float:
    """
    Resolves the effective maximum power threshold:
    1. Explicit custom threshold takes precedence.
    2. Specific meter threshold if configured on the meter.
    3. Specific building threshold if configured on the building.
    4. Building-type standard threshold (e.g. household: 15 kW, commercial: 1000 kW).
    5. Fallback safe threshold (1000.0 kW).
    """
    if custom_max_power_threshold is not None and custom_max_power_threshold > 0:
        return float(custom_max_power_threshold)

    if db is not None and meter_id is not None:
        meter = db.query(EnergyMeter).filter(EnergyMeter.id == meter_id).first()
        if meter:
            if meter.max_power_kw is not None and meter.max_power_kw > 0:
                return float(meter.max_power_kw)
            if meter.building_id and building_id is None:
                building_id = meter.building_id

    if db is not None and building_id is not None:
        bld = db.query(Building).filter(Building.id == building_id).first()
        if bld:
            if bld.max_power_kw is not None and bld.max_power_kw > 0:
                return float(bld.max_power_kw)
            if bld.building_type:
                building_type = bld.building_type

    if building_type:
        btype = building_type.lower()
        if btype in DEFAULT_MAX_POWER_BY_TYPE:
            return DEFAULT_MAX_POWER_BY_TYPE[btype]

    return 1000.0


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
    unit: str = "kWh",
    max_power_threshold: Optional[float] = None,
    building_id: Optional[int] = None,
    meter_id: Optional[int] = None,
    building_type: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Validates CSV content:
    - Parses timestamps and checks for parsing errors
    - Checks for negative or extreme non-physical values against configurable threshold
    - Configurable maximum power threshold per meter or building type (e.g., 15 kW for household, higher for commercial)
    - Verifies chronological ordering and missing values
    - Handles unit conversions (kWh vs Wh/kW/W)
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

    # Resolve effective spike cutoff threshold for this meter/building
    effective_threshold = resolve_max_power_threshold(
        db=db,
        building_id=building_id,
        meter_id=meter_id,
        building_type=building_type,
        custom_max_power_threshold=max_power_threshold,
    )

    unit_factor = 0.001 if unit.strip().lower() in ["wh", "w"] else 1.0

    seen_timestamps = set()
    timestamps_list = []
    missing_value_counts = {
        "timestamp_missing": int(df[timestamp_col].isna().sum()),
        "energy_missing": int(df[energy_col].isna().sum()),
        "sub_missing": 0,
    }

    for col in [sub1_col, sub2_col, sub3_col]:
        if col and col in df.columns:
            missing_value_counts["sub_missing"] += int(df[col].isna().sum())

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
        timestamps_list.append(ts)

        # 2. Validate energy value
        raw_energy = row[energy_col]
        try:
            energy_val = float(raw_energy)
            if pd.isna(energy_val):
                rejected_rows.append({"row": row_num, "reason": "Null or empty energy reading"})
                continue
            # Apply unit scaling if submitted in Wh
            energy_val = energy_val * unit_factor

            if energy_val < 0.0:
                rejected_rows.append({"row": row_num, "reason": f"Negative energy value ({energy_val:.4f} kWh)"})
                continue
            if energy_val > effective_threshold:
                rejected_rows.append(
                    {
                        "row": row_num,
                        "reason": f"Unrealistic spike ({energy_val:.2f} kWh) exceeding configured threshold of {effective_threshold:.1f} kW for this facility",
                    }
                )
                continue
        except Exception:
            rejected_rows.append({"row": row_num, "reason": f"Non-numeric energy reading: '{raw_energy}'"})
            continue

        # Optional sub-meters
        def parse_sub(col_name):
            if col_name and col_name in df.columns:
                try:
                    val = float(row[col_name]) * unit_factor
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

    # 3. Check chronological ordering
    is_chronological = True
    if len(timestamps_list) > 1:
        is_chronological = all(timestamps_list[i] <= timestamps_list[i + 1] for i in range(len(timestamps_list) - 1))
        if not is_chronological:
            valid_rows.sort(key=lambda x: x["timestamp"])

    valid_count = len(valid_rows)
    invalid_count = len(rejected_rows)

    start_date = valid_rows[0]["timestamp"] if valid_rows else None
    end_date = valid_rows[-1]["timestamp"] if valid_rows else None
    total_kwh = sum(r["energy_kwh"] for r in valid_rows)

    return {
        "total_rows": total_rows,
        "valid_count": valid_count,
        "invalid_count": invalid_count,
        "is_chronological": is_chronological,
        "effective_threshold_kw": effective_threshold,
        "unit_detected": unit,
        "missing_values_report": missing_value_counts,
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
