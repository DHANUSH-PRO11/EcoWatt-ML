from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.billing import BillEstimateRequest, BillEstimateResponse
from backend.app.services.billing_service import estimate_bill

router = APIRouter(prefix="/api/bills", tags=["Billing & Tariffs"])


@router.post("/estimate", response_model=BillEstimateResponse)
def calculate_bill_estimate(
    request: BillEstimateRequest,
    db: Session = Depends(get_db),
):
    """
    Calculate estimated electricity bill based on consumption, active tariff tiered slabs,
    monthly fixed charge, and taxes. Supports optional custom tariff overrides.
    """
    try:
        return estimate_bill(request, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bill calculation failed: {str(e)}")
