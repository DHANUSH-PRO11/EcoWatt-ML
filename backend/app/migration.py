import logging
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.building import Building, EnergyMeter
from backend.app.models.budget import BudgetSetting
from backend.app.models.carbon import CarbonSetting
from backend.app.models.audit import AuditLog

logger = logging.getLogger("ecowatt.migration")


def get_existing_columns(conn, table_name: str) -> set:
    try:
        result = conn.execute(text(f"PRAGMA table_info({table_name});"))
        return {row[1] for row in result.fetchall()}
    except Exception as e:
        logger.warning(f"Could not inspect columns for table {table_name}: {e}")
        return set()


def run_safe_migrations():
    """
    Safely evolves existing database tables without data loss,
    creates any new models, and ensures backward compatibility.
    """
    # 1. Create any missing tables defined in Base
    Base.metadata.create_all(bind=engine)

    # 2. Inspect and migrate existing columns
    with engine.begin() as conn:
        # Check energy_readings
        energy_cols = get_existing_columns(conn, "energy_readings")
        if energy_cols and "building_id" not in energy_cols:
            conn.execute(text("ALTER TABLE energy_readings ADD COLUMN building_id INTEGER;"))
        if energy_cols and "meter_id" not in energy_cols:
            conn.execute(text("ALTER TABLE energy_readings ADD COLUMN meter_id INTEGER;"))

        # Check anomaly_alerts
        anom_cols = get_existing_columns(conn, "anomaly_alerts")
        if anom_cols and "building_id" not in anom_cols:
            conn.execute(text("ALTER TABLE anomaly_alerts ADD COLUMN building_id INTEGER;"))
        if anom_cols and "meter_id" not in anom_cols:
            conn.execute(text("ALTER TABLE anomaly_alerts ADD COLUMN meter_id INTEGER;"))
        if anom_cols and "investigation_notes" not in anom_cols:
            conn.execute(text("ALTER TABLE anomaly_alerts ADD COLUMN investigation_notes TEXT;"))
        if anom_cols and "false_positive" not in anom_cols:
            conn.execute(text("ALTER TABLE anomaly_alerts ADD COLUMN false_positive BOOLEAN DEFAULT 0;"))
        if anom_cols and "updated_by" not in anom_cols:
            conn.execute(text("ALTER TABLE anomaly_alerts ADD COLUMN updated_by VARCHAR(64) DEFAULT 'system';"))
        if anom_cols and "detector_version" not in anom_cols:
            conn.execute(text("ALTER TABLE anomaly_alerts ADD COLUMN detector_version VARCHAR(32) DEFAULT '1.0.0';"))

        # Check forecast_records
        forecast_cols = get_existing_columns(conn, "forecast_records")
        if forecast_cols and "building_id" not in forecast_cols:
            conn.execute(text("ALTER TABLE forecast_records ADD COLUMN building_id INTEGER;"))
        if forecast_cols and "meter_id" not in forecast_cols:
            conn.execute(text("ALTER TABLE forecast_records ADD COLUMN meter_id INTEGER;"))
        if forecast_cols and "confidence_level" not in forecast_cols:
            conn.execute(text("ALTER TABLE forecast_records ADD COLUMN confidence_level FLOAT DEFAULT 0.95;"))

    # 3. Seed default buildings & meters and backfill unassigned readings
    db: Session = SessionLocal()
    try:
        bld_count = db.query(Building).count()
        if bld_count == 0:
            # Main Primary Facility
            b1 = Building(
                name="Main Residential Facility",
                code="BLD-HQ",
                building_type="household",
                location="Primary Site, Block A",
                description="Primary residential monitoring facility with high-resolution submetering",
                floor_area_sqm=185.0,
            )
            # Science Laboratory
            b2 = Building(
                name="Science & Research Laboratory",
                code="BLD-LAB-01",
                building_type="laboratory",
                location="East Campus Zone B",
                description="Specialized laboratory facility with heavy HVAC and analytical instrumentation",
                floor_area_sqm=420.0,
            )
            # Academic Classroom Hall
            b3 = Building(
                name="Academic Classroom Hall",
                code="BLD-CLS-02",
                building_type="classroom",
                location="North Academic Quad",
                description="Educational classroom block with scheduled occupancy and variable heat pump loads",
                floor_area_sqm=650.0,
            )
            # Commercial Center
            b4 = Building(
                name="Commercial & Admin Complex",
                code="BLD-ADM-03",
                building_type="commercial",
                location="South Administration Gate",
                description="Commercial administrative offices and central server utility room",
                floor_area_sqm=310.0,
            )
            db.add_all([b1, b2, b3, b4])
            db.commit()

            # Create default meters for each building
            m1 = EnergyMeter(
                meter_code="MTR-MAIN-001",
                name="Main Incomer Grid Meter",
                building_id=b1.id,
                meter_type="main",
                status="active",
            )
            m1_sub = EnergyMeter(
                meter_code="MTR-SUB-001",
                name="HVAC & Kitchen Sub-Panel",
                building_id=b1.id,
                meter_type="submeter",
                status="active",
            )
            m2 = EnergyMeter(
                meter_code="MTR-LAB-001",
                name="Lab Heavy Equipment Feeder",
                building_id=b2.id,
                meter_type="main",
                status="active",
            )
            m3 = EnergyMeter(
                meter_code="MTR-CLS-001",
                name="Classroom Heating & Lighting Feeder",
                building_id=b3.id,
                meter_type="main",
                status="active",
            )
            m4 = EnergyMeter(
                meter_code="MTR-ADM-001",
                name="Commercial Facilities Meter",
                building_id=b4.id,
                meter_type="main",
                status="active",
            )
            db.add_all([m1, m1_sub, m2, m3, m4])
            db.commit()

            # Backfill existing readings to Building 1 and Meter 1
            with engine.begin() as conn:
                conn.execute(text(f"UPDATE energy_readings SET building_id = {b1.id}, meter_id = {m1.id} WHERE building_id IS NULL;"))
                conn.execute(text(f"UPDATE anomaly_alerts SET building_id = {b1.id}, meter_id = {m1.id} WHERE building_id IS NULL;"))
                conn.execute(text(f"UPDATE forecast_records SET building_id = {b1.id}, meter_id = {m1.id} WHERE building_id IS NULL;"))

        # 4. Ensure default CarbonSetting exists
        carbon_count = db.query(CarbonSetting).count()
        if carbon_count == 0:
            db.add(
                CarbonSetting(
                    building_id=None,  # Global default
                    emissions_factor_kg_per_kwh=0.385,
                    factor_source="US EPA eGRID National Average (2024)",
                )
            )
            db.commit()

        # 5. Ensure default BudgetSetting exists
        budget_count = db.query(BudgetSetting).count()
        if budget_count == 0:
            first_bld = db.query(Building).first()
            bld_id = first_bld.id if first_bld else None
            db.add(
                BudgetSetting(
                    building_id=bld_id,
                    monthly_budget_amount=150.0,
                    monthly_kwh_target=500.0,
                    currency="USD",
                    alert_thresholds_json="[80, 90, 100]",
                    billing_cycle_day=1,
                )
            )
            db.commit()

        # 6. Record audit log for startup migration
        db.add(
            AuditLog(
                user_or_system="system",
                action="schema_migration_verified",
                resource_type="database",
                resource_id="schema",
                details_json='{"status": "schema_synchronized", "version": "2.0.0"}',
            )
        )
        db.commit()

    finally:
        db.close()
