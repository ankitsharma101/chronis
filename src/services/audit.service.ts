import { DatabaseSync } from 'node:sqlite';
import { AuditAction, AuditResult, EventType, AuditLogRecord } from '../types.js';

export interface LogActionParams {
  userId: string;
  action: AuditAction;
  result: AuditResult;
  eventType?: EventType | null;
  details?: string | null;
}

export class AuditService {
  public static logAction(db: DatabaseSync, params: LogActionParams): void {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, timestamp, action, event_type, result, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      params.userId,
      now,
      params.action,
      params.eventType ?? null,
      params.result,
      params.details ?? null
    );
  }

  public static getAuditLogs(
    db: DatabaseSync,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): { audit_logs: AuditLogRecord[]; total: number; page: number; limit: number } {
    const offset = Math.max(0, (page - 1) * limit);

    const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM audit_logs WHERE user_id = ?`);
    const countRow = countStmt.get(userId) as { total: number };
    const total = Number(countRow?.total ?? 0);

    const logsStmt = db.prepare(`
      SELECT id, user_id, timestamp, action, event_type, result, details
      FROM audit_logs
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `);

    const rows = logsStmt.all(userId, limit, offset) as unknown as AuditLogRecord[];

    return {
      audit_logs: rows,
      total,
      page,
      limit
    };
  }
}
