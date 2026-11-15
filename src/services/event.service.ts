import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { EventRecord, EventType, VALID_EVENT_TYPES } from '../types.js';
import { CreateEventInput } from '../schemas.js';
import { PrivacyService } from './privacy.service.js';
import { AuditService } from './audit.service.js';

export class EventNotFoundError extends Error {
  constructor(public eventId: string) {
    super(`Event with id '${eventId}' was not found.`);
    this.name = 'EventNotFoundError';
  }
}

export class PrivacyDeniedError extends Error {
  constructor(public eventType: EventType, public eventId?: string) {
    super(`Access to category '${eventType}' is disabled by privacy controls.${eventId ? ` (Event ID: ${eventId})` : ''}`);
    this.name = 'PrivacyDeniedError';
  }
}

export interface ListEventsOptions {
  typeFilter?: string | null;
  page?: number;
  limit?: number;
  startDate?: string | null;
  endDate?: string | null;
}

export class EventService {
  public static createEvent(
    db: DatabaseSync,
    input: CreateEventInput,
    userId: string
  ): EventRecord {
    PrivacyService.ensureUser(db, userId);

    const eventId = randomUUID();
    const now = new Date().toISOString();
    const timestamp = input.timestamp || now;

    const stmt = db.prepare(`
      INSERT INTO events (id, user_id, timestamp, type, title, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(eventId, userId, timestamp, input.type, input.title, input.content, now);

    AuditService.logAction(db, {
      userId,
      action: 'CREATE_EVENT',
      result: 'SUCCESS',
      eventType: input.type as EventType,
      details: `Created event '${eventId}' titled '${input.title}'`
    });

    return {
      id: eventId,
      user_id: userId,
      timestamp,
      type: input.type as EventType,
      title: input.title,
      content: input.content,
      created_at: now
    };
  }

  public static getEventById(
    db: DatabaseSync,
    eventId: string,
    userId: string
  ): EventRecord {
    const stmt = db.prepare(`
      SELECT id, user_id, timestamp, type, title, content, created_at
      FROM events
      WHERE id = ? AND user_id = ?
    `);

    const row = stmt.get(eventId, userId) as unknown as EventRecord | undefined;

    if (!row) {
      AuditService.logAction(db, {
        userId,
        action: 'GET_EVENT',
        result: 'ERROR',
        details: `Event '${eventId}' not found`
      });
      throw new EventNotFoundError(eventId);
    }

    const eventType = row.type;

    // Check privacy boundary
    if (!PrivacyService.isTypeAllowed(db, userId, eventType)) {
      AuditService.logAction(db, {
        userId,
        action: 'GET_EVENT',
        result: 'DENIED',
        eventType,
        details: `Blocked access to event '${eventId}': category '${eventType}' is disabled by privacy settings`
      });
      throw new PrivacyDeniedError(eventType, eventId);
    }

    AuditService.logAction(db, {
      userId,
      action: 'GET_EVENT',
      result: 'ALLOWED',
      eventType,
      details: `Retrieved event '${eventId}'`
    });

    return row;
  }

  public static listEvents(
    db: DatabaseSync,
    userId: string,
    options: ListEventsOptions = {}
  ): { events: EventRecord[]; total: number; page: number; limit: number; has_more: boolean } {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.max(1, Math.min(options.limit ?? 10, 100));
    const offset = (page - 1) * limit;

    const allowedTypes = PrivacyService.getAllowedEventTypes(db, userId);

    let effectiveTypes: EventType[] = [];

    if (options.typeFilter) {
      const filter = options.typeFilter.toLowerCase() as EventType;
      if (!VALID_EVENT_TYPES.includes(filter)) {
        throw new Error(`Invalid event type '${options.typeFilter}'. Valid types: ${VALID_EVENT_TYPES.join(', ')}`);
      }

      if (!allowedTypes.has(filter)) {
        // Disabled by privacy controls -> return 0 items
        AuditService.logAction(db, {
          userId,
          action: 'LIST_EVENTS',
          result: 'DENIED',
          eventType: filter,
          details: `Filter requested '${filter}', but category is OFF in privacy controls; 0 items returned`
        });
        return { events: [], total: 0, page, limit, has_more: false };
      }

      effectiveTypes = [filter];
    } else {
      effectiveTypes = Array.from(allowedTypes);
    }

    if (effectiveTypes.length === 0) {
      AuditService.logAction(db, {
        userId,
        action: 'LIST_EVENTS',
        result: 'SUCCESS',
        details: 'Query executed with all privacy categories OFF; 0 items returned'
      });
      return { events: [], total: 0, page, limit, has_more: false };
    }

    const conditions: string[] = ['user_id = ?'];
    const params: (string | number)[] = [userId];

    const placeholders = effectiveTypes.map(() => '?').join(', ');
    conditions.push(`type IN (${placeholders})`);
    params.push(...effectiveTypes);

    if (options.startDate) {
      conditions.push('timestamp >= ?');
      params.push(options.startDate);
    }
    if (options.endDate) {
      conditions.push('timestamp <= ?');
      params.push(options.endDate);
    }

    const whereClause = conditions.join(' AND ');

    // Total Count
    const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM events WHERE ${whereClause}`);
    const countRow = countStmt.get(...params) as { total: number };
    const total = Number(countRow?.total ?? 0);

    // Paginated Rows
    const dataStmt = db.prepare(`
      SELECT id, user_id, timestamp, type, title, content, created_at
      FROM events
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = dataStmt.all(...params, limit, offset) as unknown as EventRecord[];
    const has_more = offset + rows.length < total;

    AuditService.logAction(db, {
      userId,
      action: 'LIST_EVENTS',
      result: 'SUCCESS',
      eventType: options.typeFilter as EventType ?? null,
      details: `Listed ${rows.length} events (page ${page}, limit ${limit}, total ${total})`
    });

    return {
      events: rows,
      total,
      page,
      limit,
      has_more
    };
  }

  public static deleteEvent(
    db: DatabaseSync,
    eventId: string,
    userId: string
  ): boolean {
    const checkStmt = db.prepare(`
      SELECT id, type, title FROM events WHERE id = ? AND user_id = ?
    `);
    const row = checkStmt.get(eventId, userId) as { id: string; type: EventType; title: string } | undefined;

    if (!row) {
      AuditService.logAction(db, {
        userId,
        action: 'DELETE_EVENT',
        result: 'ERROR',
        details: `Failed to delete event '${eventId}': not found`
      });
      throw new EventNotFoundError(eventId);
    }

    const delStmt = db.prepare(`DELETE FROM events WHERE id = ? AND user_id = ?`);
    delStmt.run(eventId, userId);

    AuditService.logAction(db, {
      userId,
      action: 'DELETE_EVENT',
      result: 'SUCCESS',
      eventType: row.type,
      details: `Deleted event '${eventId}' ('${row.title}')`
    });

    return true;
  }
}
