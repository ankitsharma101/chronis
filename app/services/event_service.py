import sqlite3
import uuid
from typing import Optional, List, Dict, Any, Tuple
from app.database import get_db
from app.models import EventType, AuditAction, AuditResult
from app.schemas import EventCreate, utc_now_iso
from app.services.privacy_service import PrivacyService
from app.services.audit_service import AuditService


class EventNotFoundException(Exception):
    """Raised when an event does not exist for the user."""
    def __init__(self, event_id: str):
        self.event_id = event_id
        super().__init__(f"Event with id '{event_id}' was not found.")


class PrivacyDeniedException(Exception):
    """Raised when access to an event is blocked by privacy controls."""
    def __init__(self, event_type: str, event_id: Optional[str] = None):
        self.event_type = event_type
        self.event_id = event_id
        msg = f"Access to category '{event_type}' is disabled by privacy controls."
        if event_id:
            msg += f" (Event ID: {event_id})"
        super().__init__(msg)


class EventService:
    """Service handling CRUD operations on events with strict privacy policy enforcement."""

    @classmethod
    def create_event(
        cls,
        data: EventCreate,
        user_id: str,
        conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        """Create a new memory event."""
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()

        # Ensure user exists
        PrivacyService.ensure_user_permissions(user_id, conn)

        event_id = str(uuid.uuid4())
        timestamp = data.timestamp or utc_now_iso()
        now_iso = utc_now_iso()

        cursor.execute("""
        INSERT INTO events (id, user_id, timestamp, type, title, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (event_id, user_id, timestamp, data.type.value, data.title, data.content, now_iso))
        conn.commit()

        # Log audit entry
        AuditService.log_action(
            user_id=user_id,
            action=AuditAction.CREATE_EVENT.value,
            result=AuditResult.SUCCESS.value,
            event_type=data.type.value,
            details=f"Created event '{event_id}' titled '{data.title}'",
            conn=conn
        )

        return {
            "id": event_id,
            "user_id": user_id,
            "timestamp": timestamp,
            "type": data.type.value,
            "title": data.title,
            "content": data.content,
            "created_at": now_iso
        }

    @classmethod
    def get_event_by_id(
        cls,
        event_id: str,
        user_id: str,
        conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, Any]:
        """
        Fetch a single event by ID with strict privacy verification.
        If the event's category is currently OFF in user permissions,
        access is denied with HTTP 403 and an audit log DENIED entry is written.
        """
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
        SELECT id, user_id, timestamp, type, title, content, created_at
        FROM events
        WHERE id = ? AND user_id = ?
        """, (event_id, user_id))
        row = cursor.fetchone()

        if row is None:
            AuditService.log_action(
                user_id=user_id,
                action=AuditAction.GET_EVENT.value,
                result=AuditResult.ERROR.value,
                event_type=None,
                details=f"Event '{event_id}' not found",
                conn=conn
            )
            raise EventNotFoundException(event_id)

        event_dict = dict(row)
        event_type = event_dict["type"]

        # Check privacy permission at backend boundary
        if not PrivacyService.is_type_allowed(user_id, event_type, conn):
            # Record security audit log for blocked unauthorized attempt
            AuditService.log_action(
                user_id=user_id,
                action=AuditAction.GET_EVENT.value,
                result=AuditResult.DENIED.value,
                event_type=event_type,
                details=f"Blocked access to event '{event_id}': category '{event_type}' is disabled by privacy settings",
                conn=conn
            )
            raise PrivacyDeniedException(event_type=event_type, event_id=event_id)

        # Audit allowed read
        AuditService.log_action(
            user_id=user_id,
            action=AuditAction.GET_EVENT.value,
            result=AuditResult.ALLOWED.value,
            event_type=event_type,
            details=f"Retrieved event '{event_id}'",
            conn=conn
        )
        return event_dict

    @classmethod
    def list_events(
        cls,
        user_id: str,
        type_filter: Optional[str] = None,
        page: int = 1,
        limit: int = 10,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        conn: Optional[sqlite3.Connection] = None
    ) -> Tuple[List[Dict[str, Any]], int, bool]:
        """
        List timeline events for user, chronologically ordered (most recent first).
        Filters strictly by user privacy permissions at the SQL query level:
        data for categories turned OFF is NEVER queried or returned.
        """
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()

        allowed_types = PrivacyService.get_allowed_event_types(user_id, conn)

        # Handle specific type filter requested by user
        if type_filter:
            if type_filter not in EventType.values():
                raise ValueError(f"Invalid event type '{type_filter}'. Valid types: {', '.join(EventType.values())}")

            if type_filter not in allowed_types:
                # Requested category is disabled by privacy controls
                # Return empty list and record audit action
                AuditService.log_action(
                    user_id=user_id,
                    action=AuditAction.LIST_EVENTS.value,
                    result=AuditResult.DENIED.value,
                    event_type=type_filter,
                    details=f"Filter requested '{type_filter}', but category is OFF in privacy controls; 0 items returned",
                    conn=conn
                )
                return [], 0, False

            # Valid and allowed
            effective_types = [type_filter]
        else:
            effective_types = list(allowed_types)

        if not effective_types:
            # All categories are OFF
            AuditService.log_action(
                user_id=user_id,
                action=AuditAction.LIST_EVENTS.value,
                result=AuditResult.SUCCESS.value,
                event_type=None,
                details="Query executed with all privacy categories OFF; 0 items returned",
                conn=conn
            )
            return [], 0, False

        # Build parameterized SQL query
        conditions = ["user_id = ?"]
        params: List[Any] = [user_id]

        placeholders = ",".join(["?"] * len(effective_types))
        conditions.append(f"type IN ({placeholders})")
        params.extend(effective_types)

        if start_date:
            conditions.append("timestamp >= ?")
            params.append(start_date)

        if end_date:
            conditions.append("timestamp <= ?")
            params.append(end_date)

        where_clause = " AND ".join(conditions)

        # Count total matching records
        count_query = f"SELECT COUNT(*) AS total FROM events WHERE {where_clause}"
        cursor.execute(count_query, params)
        total = cursor.fetchone()["total"]

        # Fetch paginated records
        offset = max(0, (page - 1) * limit)
        data_query = f"""
        SELECT id, user_id, timestamp, type, title, content, created_at
        FROM events
        WHERE {where_clause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
        """
        data_params = list(params) + [limit, offset]
        cursor.execute(data_query, data_params)
        rows = cursor.fetchall()
        events = [dict(row) for row in rows]

        has_more = (offset + len(events)) < total

        # Log audit entry
        AuditService.log_action(
            user_id=user_id,
            action=AuditAction.LIST_EVENTS.value,
            result=AuditResult.SUCCESS.value,
            event_type=type_filter,
            details=f"Listed {len(events)} events (page {page}, limit {limit}, total {total})",
            conn=conn
        )

        return events, total, has_more

    @classmethod
    def delete_event(
        cls,
        event_id: str,
        user_id: str,
        conn: Optional[sqlite3.Connection] = None
    ) -> bool:
        """Delete an event by ID."""
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT id, type, title FROM events WHERE id = ? AND user_id = ?", (event_id, user_id))
        row = cursor.fetchone()

        if row is None:
            AuditService.log_action(
                user_id=user_id,
                action=AuditAction.DELETE_EVENT.value,
                result=AuditResult.ERROR.value,
                event_type=None,
                details=f"Failed to delete event '{event_id}': not found",
                conn=conn
            )
            raise EventNotFoundException(event_id)

        event_type = row["type"]
        title = row["title"]

        cursor.execute("DELETE FROM events WHERE id = ? AND user_id = ?", (event_id, user_id))
        conn.commit()

        AuditService.log_action(
            user_id=user_id,
            action=AuditAction.DELETE_EVENT.value,
            result=AuditResult.SUCCESS.value,
            event_type=event_type,
            details=f"Deleted event '{event_id}' ('{title}')",
            conn=conn
        )
        return True
