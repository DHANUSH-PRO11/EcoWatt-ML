from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.metadata import DataImportMeta
from backend.app.services.import_service import (
    preview_csv,
    validate_csv_dataset,
    execute_import,
)

router = APIRouter(prefix="/api/import", tags=["Data Import Center"])


class ExecuteImportRequest(BaseModel):
    building_id: int
    meter_id: Optional[int] = None
    source_name: str = "CSV Upload"
    is_simulated: bool = False
    valid_records: List[Dict[str, Any]]


@router.post("/preview")
async def preview_file(file: UploadFile = File(...)):
    """Upload a CSV file to preview delimiters, detected columns, and the first 10 rows."""
    if not file.filename.endswith(".csv") and not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .csv and .txt tabular files are supported.")

    content = await file.read()
    if len(content) > 25 * 1024 * 1024:  # 25 MB limit
        raise HTTPException(status_code=400, detail="File size exceeds maximum 25 MB upload limit.")

    try:
        return preview_csv(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV preview: {str(e)}")


@router.post("/validate")
async def validate_file(
    file: UploadFile = File(...),
    timestamp_col: str = Form(...),
    energy_col: str = Form(...),
    sub1_col: Optional[str] = Form(None),
    sub2_col: Optional[str] = Form(None),
    sub3_col: Optional[str] = Form(None),
    separator: str = Form(","),
):
    """Validate uploaded CSV against column mappings and identify invalid or non-physical rows."""
    content = await file.read()
    try:
        result = validate_csv_dataset(
            file_bytes=content,
            timestamp_col=timestamp_col,
            energy_col=energy_col,
            sub1_col=sub1_col,
            sub2_col=sub2_col,
            sub3_col=sub3_col,
            separator=separator,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Validation failed: {str(e)}")


@router.post("/execute", status_code=status.HTTP_201_CREATED)
def commit_import(request: ExecuteImportRequest, db: Session = Depends(get_db)):
    """Commit validated dataset into database within an atomic transaction."""
    try:
        result = execute_import(
            db=db,
            valid_records=request.valid_records,
            building_id=request.building_id,
            meter_id=request.meter_id,
            source_name=request.source_name,
            is_simulated=request.is_simulated,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
def get_import_history(db: Session = Depends(get_db)):
    """Retrieve historical imports with provenance metadata."""
    imports = db.query(DataImportMeta).order_by(DataImportMeta.imported_at.desc()).limit(20).all()
    return [
        {
            "id": m.id,
            "source_name": m.source_name,
            "imported_at": m.imported_at.strftime("%Y-%m-%d %H:%M:%S"),
            "total_rows": m.total_rows,
            "start_date": m.start_date.strftime("%Y-%m-%d %H:%M:%S"),
            "end_date": m.end_date.strftime("%Y-%m-%d %H:%M:%S"),
            "is_simulated": m.is_simulated,
        }
        for m in imports
    ]
