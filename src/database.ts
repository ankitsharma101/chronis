import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { VALID_EVENT_TYPES, EventType } from './types.js';

let dbInstance: DatabaseSync | null = null;

export function getDatabase(dbPath: string = config.databasePath): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(dbPath);
    initDatabase(dbInstance, true);
  }
  return dbInstance;
}

export function createIsolatedDatabase(dbPath: string = ':memory:'): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  initDatabase(db, false);
  return db;
}

export function initDatabase(db: DatabaseSync, seedData: boolean = true): void {
  // 1. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
  `);

  // 2. Permissions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK(event_type IN ('conversation', 'location', 'physiological', 'note')),
      is_enabled INTEGER NOT NULL DEFAULT 1 CHECK(is_enabled IN (0, 1)),
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, event_type)
    );
  `);

  // 3. Events Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('conversation', 'location', 'physiological', 'note')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_user_time ON events(user_id, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_events_user_type ON events(user_id, type);
  `);

  // 4. Audit Logs Table (Read-Only & Append-Only)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      event_type TEXT,
      result TEXT NOT NULL CHECK(result IN ('ALLOWED', 'DENIED', 'SUCCESS', 'ERROR')),
      details TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_logs(user_id, timestamp DESC);
  `);

  if (seedData) {
    seedDefaults(db);
  }
}

export function seedDefaults(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const defaultUserId = config.defaultUserId;

  // Seed demo user
  const userStmt = db.prepare(`
    INSERT OR IGNORE INTO users (id, username, created_at)
    VALUES (?, ?, ?)
  `);
  userStmt.run(defaultUserId, config.defaultUserName, now);

  // Seed default permissions (all ON)
  const permStmt = db.prepare(`
    INSERT OR IGNORE INTO permissions (user_id, event_type, is_enabled, updated_at)
    VALUES (?, ?, 1, ?)
  `);
  for (const type of VALID_EVENT_TYPES) {
    permStmt.run(defaultUserId, type, now);
  }

  // Seed timeline events if table is empty for user
  const countStmt = db.prepare(`SELECT COUNT(*) AS count FROM events WHERE user_id = ?`);
  const row = countStmt.get(defaultUserId) as { count: number };

  if (row && Number(row.count) === 0) {
    const insertEvent = db.prepare(`
      INSERT INTO events (id, user_id, timestamp, type, title, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleEvents = [
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T08:30:00.000Z',
        'physiological',
        'Resting Heart Rate & HRV Baseline',
        'Woke up at 8:15 AM. Resting heart rate: 58 bpm. HRV baseline score: 72 ms. Readiness: Optimal.',
        now
      ],
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T09:15:00.000Z',
        'location',
        'Arrived at Philz Coffee Downtown',
        'Coordinates: 37.7891, -122.4014. Visited downtown Philz Coffee for morning pour-over.',
        now
      ],
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T10:00:00.000Z',
        'conversation',
        'Sprint Planning with Engineering Team',
        'Discussed privacy-aware memory timeline architecture, API boundary authorization, and zero-leakage data filtering.',
        now
      ],
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T11:45:00.000Z',
        'note',
        'Architecture Decision: Defense-in-Depth Privacy',
        'Ensured privacy filters execute directly in SQL queries, not just in API serialization, guaranteeing 0MB leakage.',
        now
      ],
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T13:00:00.000Z',
        'location',
        'Chronis Research & Engineering Lab',
        'Entered Building B, Lab Room 402. Access logged via secure badge beacon.',
        now
      ],
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T14:30:00.000Z',
        'conversation',
        'Mentorship Chat with Lead Architect',
        'Reviewed immutable audit log requirements and keyset pagination scaling strategies for 1M events.',
        now
      ],
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T16:00:00.000Z',
        'physiological',
        'Post-Workout Cardio & Vitals',
        '30-minute cardio session. Max HR: 158 bpm, avg HR: 134 bpm. Caloric expenditure: 320 kcal.',
        now
      ],
      [
        randomUUID(),
        defaultUserId,
        '2026-11-15T17:15:00.000Z',
        'note',
        'Next Steps: Tamper-Evident Hash Chains',
        'Next iteration could incorporate cryptographic hash chaining on audit log records for verifiable immutability.',
        now
      ]
    ];

    for (const evt of sampleEvents) {
      insertEvent.run(...evt);
    }

    // Seed initial audit log
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (user_id, timestamp, action, event_type, result, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    auditStmt.run(
      defaultUserId,
      now,
      'INITIALIZE_DATABASE',
      null,
      'SUCCESS',
      'Seeded demo user, default privacy permissions, and sample memory events'
    );
  }
}
