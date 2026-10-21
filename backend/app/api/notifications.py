from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.notification_service import (
    list_notifications,
    get_unread_count,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)

router = APIRouter(prefix="/api/notifications", tags=["Notification Center"])


@router.get("")
def get_all_notifications(
    unread_only: bool = Query(False, description="Filter only unread notifications"),
    limit: int = Query(40, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Retrieve system notifications across anomalies, budget overruns, model drift, and training events."""
    return list_notifications(db, unread_only=unread_only, limit=limit)


@router.get("/unread-count")
def get_count(db: Session = Depends(get_db)):
    """Retrieve count of unread notifications for navigation badge."""
    return {"unread_count": get_unread_count(db)}


@router.post("/{id}/read")
def mark_read(
    id: int = Path(..., description="Notification ID"),
    db: Session = Depends(get_db),
):
    """Mark an individual notification as read."""
    success = mark_notification_as_read(db, notif_id=id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "success"}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    """Mark all active notifications as read."""
    count = mark_all_notifications_as_read(db)
    return {"status": "success", "updated_count": count}
