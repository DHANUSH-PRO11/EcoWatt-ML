from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.audit import AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["Audit & Security"])


@router.get("")
def list_audit_trail(
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Retrieve immutable security and configuration audit trail."""
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "timestamp": l.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "user_or_system": l.user_or_system,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "details_json": l.details_json,
        }
        for l in logs
    ]
