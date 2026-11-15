import sqlite3
import os
import uuid
from datetime import datetime, timezone
from typing import Optional
from flask import g, current_app
from app.models import EventType, DEFAULT_PERMISSIONS


def get_db(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Get or create a database connection for the current request context."""
    if db_path is None:
        if current_app:
            db_path = current_app.config.get("DATABASE_PATH", "chronis.db")
        else:
            db_path = os.getenv("DATABASE_PATH", "chronis.db")

    # In a Flask request context, reuse connection from flask.g if available
    try:
        if "db" not in g:
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("PRAGMA journal_mode = WAL;")
            g.db = conn
        return g.db
    except RuntimeError:
        # Outside Flask context (e.g. migration, CLI or direct test helper)
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn


def close_db(e=None):
    """Close the database connection on request teardown."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(db_path: Optional[str] = None, seed_sample_data: bool = True) -> None:
    """Initialize database tables and seed default user/permissions."""
    conn = get_db(db_path)
    cursor = conn.cursor()

    # 1. Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    );
    """)

    # 2. Permissions table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL CHECK(event_type IN ('conversation', 'location', 'physiological', 'note')),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, event_type)
    );
    """)

    # 3. Events table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('conversation', 'location', 'physiological', 'note')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_user_time ON events(user_id, timestamp DESC);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_user_type ON events(user_id, type);")

    # 4. Audit Logs table (Immutable & Read-Only)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        event_type TEXT,
        result TEXT NOT NULL CHECK(result IN ('ALLOWED', 'DENIED', 'SUCCESS', 'ERROR')),
        details TEXT
    );
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs(user_id, timestamp DESC);")

    conn.commit()

    if seed_sample_data:
        seed_defaults(conn)


def seed_defaults(conn: sqlite3.Connection) -> None:
    """Seed default demo user, initial privacy permissions, and sample timeline events."""
    cursor = conn.cursor()
    now_iso = datetime.now(timezone.utc).isoformat()
    default_user_id = "user_demo"

    # Seed demo user
    cursor.execute("""
    INSERT OR IGNORE INTO users (id, username, created_at)
    VALUES (?, ?, ?)
    """, (default_user_id, "Demo User", now_iso))

    # Seed default permissions (all ON)
    for event_type, is_enabled in DEFAULT_PERMISSIONS.items():
        cursor.execute("""
        INSERT OR IGNORE INTO permissions (user_id, event_type, is_enabled, updated_at)
        VALUES (?, ?, ?, ?)
        """, (default_user_id, event_type, 1 if is_enabled else 0, now_iso))

    # Seed initial timeline events if table is empty for user
    cursor.execute("SELECT COUNT(*) AS count FROM events WHERE user_id = ?", (default_user_id,))
    row = cursor.fetchone()
    if row and row["count"] == 0:
        sample_events = [
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T08:30:00+00:00",
                EventType.PHYSIOLOGICAL.value,
                "Resting Heart Rate & HRV Baseline",
                "Woke up at 8:15 AM. Resting heart rate: 58 bpm. HRV baseline score: 72 ms. Readiness: Optimal.",
                now_iso
            ),
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T09:15:00+00:00",
                EventType.LOCATION.value,
                "Arrived at Philz Coffee Downtown",
                "Coordinates: 37.7891, -122.4014. Visited downtown Philz Coffee for morning pour-over.",
                now_iso
            ),
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T10:00:00+00:00",
                EventType.CONVERSATION.value,
                "Sprint Planning with Elena & Marcus",
                "Discussed privacy-aware memory timeline architecture, API boundary authorization, and zero-leakage data filtering.",
                now_iso
            ),
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T11:45:00+00:00",
                EventType.NOTE.value,
                "Architecture Decision: Defense-in-Depth Privacy",
                "Ensured privacy filters execute directly in SQL queries, not just in API serialization, guaranteeing 0MB leakage.",
                now_iso
            ),
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T13:00:00+00:00",
                EventType.LOCATION.value,
                "Chronis Research & Engineering Lab",
                "Entered Building B, Lab Room 402. Access logged via secure badge beacon.",
                now_iso
            ),
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T14:30:00+00:00",
                EventType.CONVERSATION.value,
                "Mentorship Chat with Lead Architect",
                "Reviewed immutable audit log requirements and keyset pagination scaling strategies for 1M events.",
                now_iso
            ),
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T16:00:00+00:00",
                EventType.PHYSIOLOGICAL.value,
                "Post-Workout Cardio & Vitals",
                "30-minute high-intensity cardio session. Max HR: 158 bpm, avg HR: 134 bpm. Caloric expenditure: 320 kcal.",
                now_iso
            ),
            (
                str(uuid.uuid4()),
                default_user_id,
                "2026-11-15T17:15:00+00:00",
                EventType.NOTE.value,
                "Next Steps: Tamper-Evident Hash Chains",
                "Next iteration could incorporate cryptographic hash chaining on audit log records for verifiable immutability.",
                now_iso
            ),
        ]

        cursor.executemany("""
        INSERT INTO events (id, user_id, timestamp, type, title, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, sample_events)

        # Log initial system seed in audit log
        cursor.execute("""
        INSERT INTO audit_logs (user_id, timestamp, action, event_type, result, details)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (default_user_id, now_iso, "INITIALIZE_DATABASE", None, "SUCCESS", "Seeded demo user, default privacy permissions, and sample timeline events"))

    conn.commit()
