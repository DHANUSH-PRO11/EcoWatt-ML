import os
import argparse
from pathlib import Path
from typing import Optional, Tuple
import numpy as np
import pandas as pd

from ml.config import (
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
    HOURLY_DATA_FILE,
    DAILY_DATA_FILE,
    DATETIME_COL,
    TARGET_COL,
)


def process_uci_raw_dataset(
    raw_path: Path,
    output_hourly_path: Path = HOURLY_DATA_FILE,
    output_daily_path: Path = DAILY_DATA_FILE,
    chunk_size: int = 100_000,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Parse and process the official UCI Household Electric Power Consumption dataset.
    - Combines Date and Time into datetime.
    - Converts minute-level Global_active_power (kW) to hourly energy consumption (kWh).
    - Submetering Wh values are converted to kWh.
    - Aggregates chronologically into hourly and daily datasets.
    """
    if not os.path.exists(raw_path):
        raise FileNotFoundError(f"Raw dataset file not found at: {raw_path}")

    print(f"Reading raw UCI dataset from: {raw_path} ...")

    # The UCI dataset is semicolon delimited with '?' representing missing measurements
    chunks = []
    for chunk in pd.read_csv(
        raw_path,
        sep=";",
        na_values=["?"],
        dtype={
            "Date": str,
            "Time": str,
            "Global_active_power": float,
            "Global_reactive_power": float,
            "Voltage": float,
            "Global_intensity": float,
            "Sub_metering_1": float,
            "Sub_metering_2": float,
            "Sub_metering_3": float,
        },
        chunksize=chunk_size,
        low_memory=False,
    ):
        # Create timestamp
        chunk["timestamp"] = pd.to_datetime(
            chunk["Date"] + " " + chunk["Time"], format="%d/%m/%Y %H:%M:%S", errors="coerce"
        )
        chunk = chunk.dropna(subset=["timestamp"])
        chunks.append(chunk)

    df = pd.concat(chunks, ignore_index=True)
    df = df.sort_values("timestamp").drop_duplicates(subset=["timestamp"])

    # Forward fill missing values up to 120 minutes (2 hours), then linear interpolate
    measurement_cols = [
        "Global_active_power",
        "Global_reactive_power",
        "Voltage",
        "Global_intensity",
        "Sub_metering_1",
        "Sub_metering_2",
        "Sub_metering_3",
    ]
    df[measurement_cols] = df[measurement_cols].ffill(limit=120).interpolate(method="linear")

    # Drop any remaining unfillable NaNs
    df = df.dropna(subset=measurement_cols)

    # Set timestamp index for hourly aggregation
    df = df.set_index("timestamp")

    print("Aggregating minute data to hourly energy consumption...")
    # Power to Energy Conversion:
    # Global_active_power is in kW. Minute energy = kW * (1/60) h.
    # Over 60 minutes in an hour: sum(kW * 1/60) = mean(kW) * 1.0 h = energy in kWh.
    hourly = df.resample("1h").agg(
        {
            "Global_active_power": "mean",  # mean kW * 1h = kWh
            "Global_reactive_power": "mean",
            "Voltage": "mean",
            "Global_intensity": "mean",
            "Sub_metering_1": lambda x: x.sum() / 1000.0,  # Wh sum to kWh
            "Sub_metering_2": lambda x: x.sum() / 1000.0,  # Wh sum to kWh
            "Sub_metering_3": lambda x: x.sum() / 1000.0,  # Wh sum to kWh
        }
    )

    # Rename to clear domain attributes
    hourly = hourly.rename(
        columns={
            "Global_active_power": "energy_kwh",
            "Global_reactive_power": "reactive_power_kvar",
            "Voltage": "voltage",
            "Global_intensity": "global_intensity",
            "Sub_metering_1": "sub_metering_1_kwh",
            "Sub_metering_2": "sub_metering_2_kwh",
            "Sub_metering_3": "sub_metering_3_kwh",
        }
    )

    hourly["energy_kwh"] = hourly["energy_kwh"].clip(lower=0.0)
    # Calculate remainder submetering (other household circuits)
    total_submetered = (
        hourly["sub_metering_1_kwh"] + hourly["sub_metering_2_kwh"] + hourly["sub_metering_3_kwh"]
    )
    hourly["sub_metering_other_kwh"] = (hourly["energy_kwh"] - total_submetered).clip(lower=0.0)
    hourly["is_simulated"] = False

    # Reset index and clean
    hourly = hourly.reset_index()
    hourly["timestamp"] = hourly["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")

    # Drop missing aggregated periods
    hourly = hourly.dropna(subset=["energy_kwh"]).reset_index(drop=True)

    # Daily aggregation
    daily = create_daily_aggregation(hourly)

    # Save to disk
    hourly.to_csv(output_hourly_path, index=False)
    daily.to_csv(output_daily_path, index=False)
    print(f"Successfully processed {len(hourly)} hourly records to {output_hourly_path}")

    return hourly, daily


def generate_sample_dataset(
    days: int = 180,
    output_hourly_path: Path = HOURLY_DATA_FILE,
    output_daily_path: Path = DAILY_DATA_FILE,
    seed: int = 42,
    end_date: Optional[str] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Generate realistic multi-month hourly household electricity consumption dataset.
    Accurately mirrors statistical properties of the UCI Household Electric Power dataset:
    - Diurnal baseload, morning peak, evening cooking peak
    - Weekend load shift
    - Seasonal temperature effects
    - Sub-metering breakdown (Kitchen, Laundry, Climate/Water, Other)
    - Realistic noise and anomalous consumption spikes
    - Marked with is_simulated = True
    """
    np.random.seed(seed)
    print(f"Generating realistic {days}-day household consumption dataset (seed={seed})...")

    if end_date:
        end_ts = pd.to_datetime(end_date)
    else:
        # Align end date near current time (rounded down to full hour)
        end_ts = pd.Timestamp.now().floor("h")

    start_ts = end_ts - pd.Timedelta(days=days)
    date_range = pd.date_range(start=start_ts, end=end_ts, freq="1h")

    n = len(date_range)
    hours = date_range.hour.values
    dows = date_range.dayofweek.values
    months = date_range.month.values

    # 1. Baseload (refrigeration, standby appliances, always-on electronics)
    # Range: 0.25 to 0.45 kWh/h
    baseload = 0.32 + np.random.normal(0, 0.03, size=n)

    # 2. Daily diurnal cycle:
    # Morning peak (06:30 - 09:30): breakfast, coffee, water heater, lighting
    morning_peak = 0.95 * np.exp(-0.5 * ((hours - 8.0) / 1.5) ** 2)
    # Weekend morning shifts later to 09:00 - 11:00
    weekend_mask = (dows >= 5).astype(float)
    morning_peak = morning_peak * (1.0 - weekend_mask * 0.4) + weekend_mask * (
        1.1 * np.exp(-0.5 * ((hours - 9.5) / 1.8) ** 2)
    )

    # Evening peak (17:30 - 22:30): dinner preparation, oven, dishwasher, entertainment, lighting
    evening_peak = 1.65 * np.exp(-0.5 * ((hours - 19.5) / 2.0) ** 2)

    # Midday plateau: higher on weekends
    midday = 0.25 * np.sin(np.pi * (hours - 6) / 16.0).clip(min=0.0)
    midday += weekend_mask * 0.45 * np.sin(np.pi * (hours - 8) / 12.0).clip(min=0.0)

    # 3. Seasonal modulation (winter heating / higher lighting in Dec-Feb, summer AC in Jul-Aug)
    seasonal_factor = 1.0 + 0.28 * np.cos(2 * np.pi * (months - 1) / 12.0)

    # 4. Stochastic variation & appliance burst spikes
    noise = np.random.exponential(scale=0.15, size=n)

    # Calculate preliminary total active energy (kWh)
    energy_kwh = (baseload + morning_peak + evening_peak + midday) * seasonal_factor + noise

    # Inject realistic intentional anomaly spikes (~2.5% of records) for anomaly detection training & evaluation
    anomaly_indices = np.random.choice(n, size=int(n * 0.025), replace=False)
    for idx in anomaly_indices:
        h = hours[idx]
        if 1 <= h <= 4:
            # Abnormal overnight spike (e.g. space heater or leak or forgotten equipment)
            energy_kwh[idx] += np.random.uniform(2.5, 4.5)
        else:
            # Daytime extreme overload spike (multiple heavy appliances running simultaneously)
            energy_kwh[idx] += np.random.uniform(3.5, 6.0)

    # Ensure non-negative
    energy_kwh = np.clip(energy_kwh, a_min=0.08, a_max=12.0)

    # 5. Realistic Sub-metering apportionment matching UCI specifications:
    # Sub 1: Kitchen (dishwasher, oven, microwave) -> spikes during meal hours
    kitchen_prob = 0.25 * (
        np.exp(-0.5 * ((hours - 8.0) / 1.0) ** 2)
        + np.exp(-0.5 * ((hours - 13.0) / 1.2) ** 2)
        + 1.8 * np.exp(-0.5 * ((hours - 19.5) / 1.5) ** 2)
    )
    sub_1 = np.clip(
        energy_kwh * 0.25 * kitchen_prob + np.random.uniform(0, 0.05, size=n), 0, energy_kwh * 0.5
    )

    # Sub 2: Laundry (washing machine, dryer, fridge) -> predominantly weekend & Wed evenings
    laundry_weight = (weekend_mask * 0.6 + (dows == 2).astype(float) * 0.4) * np.exp(
        -0.5 * ((hours - 11.0) / 2.5) ** 2
    )
    sub_2 = np.clip(
        energy_kwh * 0.20 * laundry_weight + np.random.uniform(0, 0.03, size=n), 0, energy_kwh * 0.45
    )

    # Sub 3: Climate & Water Heater -> higher overnight and in winter
    climate_factor = 0.35 * seasonal_factor + 0.15 * np.exp(-0.5 * ((hours - 6.0) / 2.0) ** 2)
    sub_3 = np.clip(
        energy_kwh * 0.32 * climate_factor + np.random.uniform(0.02, 0.08, size=n),
        0,
        energy_kwh * 0.6,
    )

    # Sub other: Lighting, TV, PCs, baseload remainder
    sub_other = np.clip(energy_kwh - (sub_1 + sub_2 + sub_3), a_min=0.02, a_max=None)

    # Electrical line parameters
    voltage = 230.0 + np.random.normal(0, 3.5, size=n)
    voltage = np.clip(voltage, 215.0, 245.0)
    # Intensity in Amperes = Power in Watts / Voltage (approx P = V * I * pf, pf ~ 0.95)
    global_intensity = (energy_kwh * 1000.0) / (voltage * 0.92)
    reactive_power = energy_kwh * np.random.uniform(0.08, 0.18, size=n)

    df_hourly = pd.DataFrame(
        {
            DATETIME_COL: date_range.strftime("%Y-%m-%d %H:%M:%S"),
            TARGET_COL: np.round(energy_kwh, 4),
            "reactive_power_kvar": np.round(reactive_power, 4),
            "voltage": np.round(voltage, 2),
            "global_intensity": np.round(global_intensity, 2),
            "sub_metering_1_kwh": np.round(sub_1, 4),
            "sub_metering_2_kwh": np.round(sub_2, 4),
            "sub_metering_3_kwh": np.round(sub_3, 4),
            "sub_metering_other_kwh": np.round(sub_other, 4),
            "is_simulated": True,
        }
    )

    df_daily = create_daily_aggregation(df_hourly)

    # Save to disk
    output_hourly_path.parent.mkdir(parents=True, exist_ok=True)
    df_hourly.to_csv(output_hourly_path, index=False)
    df_daily.to_csv(output_daily_path, index=False)
    print(f"Sample dataset generated successfully: {len(df_hourly)} hourly rows saved to {output_hourly_path}")

    return df_hourly, df_daily


def create_daily_aggregation(hourly_df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate hourly energy consumption records into daily metrics.
    """
    df = hourly_df.copy()
    df["date"] = pd.to_datetime(df[DATETIME_COL]).dt.date

    daily = df.groupby("date").agg(
        energy_kwh=(TARGET_COL, "sum"),
        peak_hour_kwh=(TARGET_COL, "max"),
        min_hour_kwh=(TARGET_COL, "min"),
        avg_hourly_kwh=(TARGET_COL, "mean"),
        sub_metering_1_kwh=("sub_metering_1_kwh", "sum"),
        sub_metering_2_kwh=("sub_metering_2_kwh", "sum"),
        sub_metering_3_kwh=("sub_metering_3_kwh", "sum"),
        sub_metering_other_kwh=("sub_metering_other_kwh", "sum"),
        avg_voltage=("voltage", "mean"),
        is_simulated=("is_simulated", "first"),
    )

    daily = daily.reset_index()
    daily["date"] = daily["date"].astype(str)
    return daily


def get_or_load_dataset(force_generate_sample: bool = False) -> pd.DataFrame:
    """
    Main entrypoint to retrieve consumption data:
    1. If force_generate_sample is True, generates synthetic dataset.
    2. If raw UCI file exists in data/raw/, processes it.
    3. If processed CSV exists, loads it.
    4. Otherwise, generates realistic sample dataset.
    """
    if force_generate_sample:
        df_hourly, _ = generate_sample_dataset()
        return df_hourly

    # Check for raw UCI dataset
    raw_files = [
        RAW_DATA_DIR / "household_power_consumption.txt",
        RAW_DATA_DIR / "household_power_consumption.csv",
    ]
    for raw_file in raw_files:
        if raw_file.exists():
            print(f"Found raw UCI dataset at {raw_file}. Processing...")
            df_hourly, _ = process_uci_raw_dataset(raw_file)
            return df_hourly

    # Check if processed CSV exists
    if HOURLY_DATA_FILE.exists():
        print(f"Loading existing processed dataset from {HOURLY_DATA_FILE}...")
        df = pd.read_csv(HOURLY_DATA_FILE)
        return df

    # Fallback to generating sample dataset
    print("No existing dataset found. Generating realistic sample dataset...")
    df_hourly, _ = generate_sample_dataset()
    return df_hourly


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EcoWatt ML Data Ingestion & Preprocessing Pipeline")
    parser.add_argument("--raw-path", type=str, default=None, help="Path to raw UCI dataset file")
    parser.add_argument("--generate-sample", action="store_true", help="Generate realistic sample dataset")
    parser.add_argument("--days", type=int, default=180, help="Number of days to generate for sample dataset")
    args = parser.parse_args()

    if args.raw_path:
        process_uci_raw_dataset(Path(args.raw_path))
    elif args.generate_sample:
        generate_sample_dataset(days=args.days)
    else:
        get_or_load_dataset()
