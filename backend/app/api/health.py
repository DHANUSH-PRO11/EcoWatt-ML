from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.app.database import get_db
from backend.app.config import settings
from ml.config import BEST_MODEL_FILE

router = APIRouter(prefix="/api/health", tags=["Health"])


@router.get("")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint checking database connectivity and ML model availability."""
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    model_status = "available" if BEST_MODEL_FILE.exists() else "not_trained"

    return {
        "status": "online" if db_status == "healthy" else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app_name": settings.APP_NAME,
        "database": db_status,
        "ml_forecaster": model_status,
        "environment": settings.APP_ENV,
    }
