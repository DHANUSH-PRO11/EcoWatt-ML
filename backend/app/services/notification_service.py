from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.models.notification import Notification


def list_notifications(
    db: Session,
    unread_only: bool = False,
    limit: int = 40,
) -> List[Dict[str, Any]]:
    query = db.query(Notification)
    if unread_only:
        query = query.filter(Notification.is_read == False)

    records = query.order_by(Notification.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "building_id": r.building_id,
            "category": r.category,
            "severity": r.severity,
            "title": r.title,
            "message": r.message,
            "link_url": r.link_url,
            "is_read": r.is_read,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        }
        for r in records
    ]


def get_unread_count(db: Session) -> int:
    return db.query(Notification).filter(Notification.is_read == False).count()


def mark_notification_as_read(db: Session, notif_id: int) -> bool:
    notif = db.query(Notification).filter(Notification.id == notif_id).first()
    if not notif:
        return False
    notif.is_read = True
    db.commit()
    return True


def mark_all_notifications_as_read(db: Session) -> int:
    updated = db.query(Notification).filter(Notification.is_read == False).update({Notification.is_read: True})
    db.commit()
    return updated


def create_notification(
    db: Session,
    category: str,
    severity: str,
    title: str,
    message: str,
    link_url: Optional[str] = None,
    building_id: Optional[int] = None,
) -> Optional[Notification]:
    """
    Creates notification if an identical notification was not created in the last 12 hours.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=12)
    existing = (
        db.query(Notification)
        .filter(
            Notification.category == category,
            Notification.title == title,
            Notification.created_at >= cutoff,
        )
        .first()
    )
    if existing:
        return existing

    notif = Notification(
        building_id=building_id,
        category=category,
        severity=severity,
        title=title,
        message=message,
        link_url=link_url,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
