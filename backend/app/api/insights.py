from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.insights import InsightsResponse
from backend.app.services.insights_service import generate_energy_insights

router = APIRouter(prefix="/api/insights", tags=["Insights & Recommendations"])


@router.get("", response_model=InsightsResponse)
def get_insights(db: Session = Depends(get_db)):
    """Retrieve actionable, evidence-based energy savings recommendations derived from real consumption data."""
    try:
        return generate_energy_insights(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate energy insights: {str(e)}")
