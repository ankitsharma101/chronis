import { DatabaseSync } from 'node:sqlite';
import { EventType, PermissionsMap, VALID_EVENT_TYPES } from '../types.js';
import { AuditService } from './audit.service.js';

export class PrivacyService {
  public static ensureUser(db: DatabaseSync, userId: string): void {
    const now = new Date().toISOString();

    const userStmt = db.prepare(`
      INSERT OR IGNORE INTO users (id, username, created_at)
      VALUES (?, ?, ?)
    `);
    userStmt.run(userId, `User ${userId}`, now);

    const permStmt = db.prepare(`
      INSERT OR IGNORE INTO permissions (user_id, event_type, is_enabled, updated_at)
      VALUES (?, ?, 1, ?)
    `);
    for (const type of VALID_EVENT_TYPES) {
      permStmt.run(userId, type, now);
    }
  }

  public static getPermissions(db: DatabaseSync, userId: string): PermissionsMap {
    this.ensureUser(db, userId);

    const stmt = db.prepare(`
      SELECT event_type, is_enabled
      FROM permissions
      WHERE user_id = ?
    `);

    const rows = stmt.all(userId) as Array<{ event_type: EventType; is_enabled: number }>;
    const perms: Partial<PermissionsMap> = {};

    for (const row of rows) {
      perms[row.event_type] = Boolean(row.is_enabled);
    }

    // Default any missing to true
    for (const type of VALID_EVENT_TYPES) {
      if (perms[type] === undefined) {
        perms[type] = true;
      }
    }

    return perms as PermissionsMap;
  }

  public static getAllowedEventTypes(db: DatabaseSync, userId: string): Set<EventType> {
    const perms = this.getPermissions(db, userId);
    const allowed = new Set<EventType>();
    for (const [type, isEnabled] of Object.entries(perms) as [EventType, boolean][]) {
      if (isEnabled) {
        allowed.add(type);
      }
    }
    return allowed;
  }

  public static isTypeAllowed(db: DatabaseSync, userId: string, eventType: EventType): boolean {
    const perms = this.getPermissions(db, userId);
    return Boolean(perms[eventType]);
  }

  public static updatePermissions(
    db: DatabaseSync,
    userId: string,
    updates: Partial<PermissionsMap>
  ): PermissionsMap {
    this.ensureUser(db, userId);
    const now = new Date().toISOString();
    const current = this.getPermissions(db, userId);

    const updateStmt = db.prepare(`
      UPDATE permissions
      SET is_enabled = ?, updated_at = ?
      WHERE user_id = ? AND event_type = ?
    `);

    for (const [key, val] of Object.entries(updates) as [EventType, boolean | undefined][]) {
      if (val === undefined || !VALID_EVENT_TYPES.includes(key)) continue;

      if (current[key] !== val) {
        updateStmt.run(val ? 1 : 0, now, userId, key);

        AuditService.logAction(db, {
          userId,
          action: 'UPDATE_PERMISSION',
          result: 'SUCCESS',
          eventType: key,
          details: `Permission for '${key}' set to ${val ? 'ON' : 'OFF'}`
        });
      }
    }

    return this.getPermissions(db, userId);
  }
}
