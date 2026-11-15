import sqlite3
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from app.database import get_db
from app.schemas import utc_now_iso


class AuditService:
    """Service for recording and retrieving immutable audit logs."""

    @staticmethod
    def log_action(
        user_id: str,
        action: str,
        result: str,
        event_type: Optional[str] = None,
        details: Optional[str] = None,
        conn: Optional[sqlite3.Connection] = None
    ) -> int:
        """Insert a new audit record into the audit_logs table."""
        close_on_finish = False
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()
        now_iso = utc_now_iso()

        cursor.execute("""
        INSERT INTO audit_logs (user_id, timestamp, action, event_type, result, details)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (user_id, now_iso, action, event_type, result, details))
        conn.commit()
        return cursor.lastrowid

    @staticmethod
    def get_audit_logs(
        user_id: str,
        page: int = 1,
        limit: int = 50,
        conn: Optional[sqlite3.Connection] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Fetch audit log records for a user with pagination (most recent first)."""
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()

        offset = max(0, (page - 1) * limit)

        # Total count
        cursor.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE user_id = ?", (user_id,))
        total = cursor.fetchone()["total"]

        # Page records
        cursor.execute("""
        SELECT id, timestamp, user_id, action, event_type, result, details
        FROM audit_logs
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ? OFFSET ?
        """, (user_id, limit, offset))

        rows = cursor.fetchall()
        logs = [dict(row) for row in rows]
        return logs, total
