# EcoWatt ML — Dataset Instructions & Documentation

This document explains the electricity consumption data source, data placement guidelines, feature engineering definitions, and the power-to-energy conversion methodology.

---

## 1. Primary Dataset: UCI Individual Household Electric Power Consumption

The primary benchmark dataset is the **Individual Household Electric Power Consumption** dataset from the UCI Machine Learning Repository:
- **UCI URL**: [UCI Machine Learning Repository #235](https://archive.ics.uci.edu/dataset/235/individual+household+electric+power+consumption)
- **Direct Download**: The archive is distributed as `household_power_consumption.zip` containing `household_power_consumption.txt`.

### How to Download & Place the Dataset
1. Download the archive from the UCI repository link above.
2. Extract the file `household_power_consumption.txt`.
3. Place `household_power_consumption.txt` inside the `data/raw/` directory:
   ```text
   g:/EcoWatt-ML/data/raw/household_power_consumption.txt
   ```
4. Run the data preparation script:
   ```bash
   python -m ml.dataset --raw-path data/raw/household_power_consumption.txt --output-dir data/processed
   ```

---

## 2. Dataset Structure & Attributes

The raw dataset contains 2,075,259 measurements collected between December 2006 and November 2010 (47 months) at 1-minute intervals:

| Column | Type | Description | Unit |
| :--- | :--- | :--- | :--- |
| `Date` | String | Date in format `dd/mm/yyyy` | Date |
| `Time` | String | Time in format `hh:mm:ss` | Time |
| `Global_active_power` | Float | Household global minute-averaged active power | Kilowatt (kW) |
| `Global_reactive_power` | Float | Household global minute-averaged reactive power | Kilowatt (kW) |
| `Voltage` | Float | Minute-averaged line voltage | Volt (V) |
| `Global_intensity` | Float | Minute-averaged current intensity | Ampere (A) |
| `Sub_metering_1` | Float | Sub-meter No. 1: Kitchen (dishwasher, oven, microwave) | Watt-hour (Wh) |
| `Sub_metering_2` | Float | Sub-meter No. 2: Laundry room (washer, dryer, fridge, lights) | Watt-hour (Wh) |
| `Sub_metering_3` | Float | Sub-meter No. 3: Electric water heater & air conditioner | Watt-hour (Wh) |

Missing values in the raw dataset are marked as `?`.

---

## 3. Power (kW) vs. Energy (kWh) Conversion

A critical physical distinction in power systems is the difference between instantaneous power and cumulative energy:
- **Active Power ($P$)**: Measured in kilowatts (**kW**), this represents the rate of doing work.
- **Energy Consumed ($E$)**: Measured in kilowatt-hours (**kWh**), calculated by integrating power over time:
  $$\text{Energy (kWh)} = \int P(t) \, dt$$

### Hourly Aggregation Formula
Because the raw data provides minute-averaged active power in kW:
1. Active energy consumed in 1 minute:
   $$E_{\text{minute}} = P_{\text{kW}} \times \frac{1}{60} \text{ h}$$
2. Over one full hour (60 minutes):
   $$E_{\text{hour}} (\text{kWh}) = \sum_{m=1}^{60} \left( P_{m} \times \frac{1}{60} \right) = \overline{P_{\text{hour}}} \times 1 \text{ hour}$$
   Therefore, the average active power (in kW) across the 60 minutes of an hour is numerically equal to the hourly energy consumption in **kWh**.
3. **Sub-metering conversion**:
   Raw sub-metering values are in Watt-hours (Wh) for each minute. For an hour:
   $$E_{\text{sub\_kwh}} = \frac{\sum_{m=1}^{60} \text{Sub\_metering}_m}{1000} \text{ kWh}$$
4. **Sub-metering remainder (Other household circuits)**:
   $$E_{\text{sub\_other}} = E_{\text{hour}} - (E_{\text{sub\_1}} + E_{\text{sub\_2}} + E_{\text{sub\_3}})$$

---

## 4. Local Quick-Testing Sample Data

To enable rapid development, testing, and continuous integration without requiring a multi-hundred megabyte download on startup:
- The system includes a realistic multi-month synthetic household generator (`ml/dataset.py`).
- It models diurnal cycles (morning and evening cooking/laundry spikes), weekend load shifts, seasonal variance, sub-metering partitions, and occasional anomalies.
- All generated records are tagged with `is_simulated = True` so users and the database can clearly distinguish them from official UCI recordings (`is_simulated = False`).
