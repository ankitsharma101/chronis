from datetime import datetime, timezone
from typing import Optional, Dict, List
from pydantic import BaseModel, Field, field_validator
from app.models import EventType, AuditAction, AuditResult


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Short title of the event")
    content: str = Field(..., min_length=1, description="Event payload or descriptive body")
    type: EventType = Field(..., description="Category: conversation, location, physiological, note")
    timestamp: Optional[str] = Field(default=None, description="ISO 8601 timestamp; defaults to now (UTC)")
    user_id: Optional[str] = Field(default=None, description="Target user identifier")

    @field_validator("timestamp", mode="before")
    @classmethod
    def validate_timestamp(cls, v):
        if v is None or v == "":
            return utc_now_iso()
        # Verify valid datetime string or convert
        try:
            # support ISO formats with or without Z
            cleaned = str(v).replace("Z", "+00:00")
            dt = datetime.fromisoformat(cleaned)
            return dt.isoformat()
        except Exception:
            raise ValueError("Timestamp must be a valid ISO 8601 string (e.g., 2026-11-15T10:00:00Z)")


class EventResponse(BaseModel):
    id: str
    user_id: str
    timestamp: str
    type: str
    title: str
    content: str
    created_at: Optional[str] = None


class EventListResponse(BaseModel):
    events: List[EventResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class PermissionsUpdate(BaseModel):
    conversation: Optional[bool] = None
    location: Optional[bool] = None
    physiological: Optional[bool] = None
    note: Optional[bool] = None


class PermissionsResponse(BaseModel):
    user_id: str
    permissions: Dict[str, bool]
    updated_at: Optional[str] = None


class AuditLogResponse(BaseModel):
    id: int
    timestamp: str
    user_id: str
    action: str
    event_type: Optional[str] = None
    result: str
    details: Optional[str] = None


class AuditLogListResponse(BaseModel):
    audit_logs: List[AuditLogResponse]
    total: int
    page: int
    limit: int
