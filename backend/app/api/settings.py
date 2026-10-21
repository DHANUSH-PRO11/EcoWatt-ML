from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.tariff import TariffSettingUpdate, TariffSettingResponse
from backend.app.services.tariff_service import (
    get_or_create_active_tariff,
    update_active_tariff,
    serialize_tariff_response,
)
from backend.app.models.metadata import DataImportMeta, ModelEvaluationMeta

router = APIRouter(prefix="/api/settings", tags=["Settings & Configuration"])


@router.get("/tariff", response_model=TariffSettingResponse)
def get_tariff(db: Session = Depends(get_db)):
    """Retrieve active electricity tariff configuration."""
    tariff = get_or_create_active_tariff(db)
    return serialize_tariff_response(tariff)


@router.put("/tariff", response_model=TariffSettingResponse)
def modify_tariff(
    update_data: TariffSettingUpdate,
    db: Session = Depends(get_db),
):
    """Update active electricity tariff configuration including tiered slabs, fixed charges, and taxes."""
    try:
        updated = update_active_tariff(db, update_data)
        return serialize_tariff_response(updated)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update tariff: {str(e)}")


@router.get("/system-status")
def get_system_status(db: Session = Depends(get_db)):
    """Retrieve data source status, database ingestion details, and active model status."""
    import_meta = db.query(DataImportMeta).order_by(DataImportMeta.imported_at.desc()).first()
    model_meta = db.query(ModelEvaluationMeta).filter(ModelEvaluationMeta.is_active == True).first()

    return {
        "dataset": {
            "source_name": import_meta.source_name if import_meta else "Simulated Household Profile",
            "imported_at": import_meta.imported_at.isoformat() if import_meta else None,
            "total_rows": import_meta.total_rows if import_meta else 0,
            "start_date": import_meta.start_date.isoformat() if import_meta else None,
            "end_date": import_meta.end_date.isoformat() if import_meta else None,
            "is_simulated": import_meta.is_simulated if import_meta else True,
        },
        "active_model": {
            "model_name": model_meta.best_model_name if model_meta else "None",
            "trained_at": model_meta.trained_at.isoformat() if model_meta else None,
            "val_mae": model_meta.val_mae if model_meta else None,
            "val_r2": model_meta.val_r2 if model_meta else None,
            "test_mae": model_meta.test_mae if model_meta else None,
            "test_r2": model_meta.test_r2 if model_meta else None,
        },
    }
