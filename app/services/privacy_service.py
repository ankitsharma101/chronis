import sqlite3
from typing import Dict, Set, Optional
from app.database import get_db
from app.models import EventType, DEFAULT_PERMISSIONS, AuditAction, AuditResult
from app.schemas import utc_now_iso
from app.services.audit_service import AuditService


class PrivacyService:
    """Service responsible for managing category-level privacy permissions and enforcement."""

    @staticmethod
    def ensure_user_permissions(user_id: str, conn: Optional[sqlite3.Connection] = None) -> None:
        """Ensure the user exists and has permission rows for all 4 categories."""
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()
        now_iso = utc_now_iso()

        # Ensure user exists in users table
        cursor.execute("""
        INSERT OR IGNORE INTO users (id, username, created_at)
        VALUES (?, ?, ?)
        """, (user_id, f"User {user_id}", now_iso))

        # Ensure all 4 categories have a row in permissions
        for event_type, default_val in DEFAULT_PERMISSIONS.items():
            cursor.execute("""
            INSERT OR IGNORE INTO permissions (user_id, event_type, is_enabled, updated_at)
            VALUES (?, ?, ?, ?)
            """, (user_id, event_type, 1 if default_val else 0, now_iso))
        conn.commit()

    @classmethod
    def get_permissions(cls, user_id: str, conn: Optional[sqlite3.Connection] = None) -> Dict[str, bool]:
        """Return the dictionary of category permissions for the user (e.g. {'conversation': True, ...})."""
        cls.ensure_user_permissions(user_id, conn)
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
        SELECT event_type, is_enabled
        FROM permissions
        WHERE user_id = ?
        """, (user_id,))
        rows = cursor.fetchall()

        perms = {}
        for row in rows:
            perms[row["event_type"]] = bool(row["is_enabled"])
        return perms

    @classmethod
    def get_allowed_event_types(cls, user_id: str, conn: Optional[sqlite3.Connection] = None) -> Set[str]:
        """Return the set of event type names that are currently enabled (ON) for the user."""
        perms = cls.get_permissions(user_id, conn)
        return {k for k, v in perms.items() if v is True}

    @classmethod
    def is_type_allowed(cls, user_id: str, event_type: str, conn: Optional[sqlite3.Connection] = None) -> bool:
        """Check whether a specific category is enabled."""
        perms = cls.get_permissions(user_id, conn)
        return perms.get(event_type, False)

    @classmethod
    def update_permissions(
        cls,
        user_id: str,
        updates: Dict[str, bool],
        conn: Optional[sqlite3.Connection] = None
    ) -> Dict[str, bool]:
        """
        Update one or more permissions for a user.
        Records an audit log entry for every changed permission.
        """
        cls.ensure_user_permissions(user_id, conn)
        if conn is None:
            conn = get_db()
        cursor = conn.cursor()
        now_iso = utc_now_iso()

        valid_types = EventType.values()
        current = cls.get_permissions(user_id, conn)

        changed_items = []
        for cat, new_val in updates.items():
            if cat not in valid_types:
                continue
            if new_val is None:
                continue
            new_bool = bool(new_val)
            if current.get(cat) != new_bool:
                cursor.execute("""
                UPDATE permissions
                SET is_enabled = ?, updated_at = ?
                WHERE user_id = ? AND event_type = ?
                """, (1 if new_bool else 0, now_iso, user_id, cat))
                changed_items.append((cat, new_bool))

        conn.commit()

        # Record audit trail for modifications
        for cat, new_bool in changed_items:
            AuditService.log_action(
                user_id=user_id,
                action=AuditAction.UPDATE_PERMISSION.value,
                event_type=cat,
                result=AuditResult.SUCCESS.value,
                details=f"Permission for '{cat}' set to {'ON' if new_bool else 'OFF'}",
                conn=conn
            )

        return cls.get_permissions(user_id, conn)
