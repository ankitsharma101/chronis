export type EventType = 'conversation' | 'location' | 'physiological' | 'note';

export const VALID_EVENT_TYPES: readonly EventType[] = [
  'conversation',
  'location',
  'physiological',
  'note'
] as const;

export type AuditAction =
  | 'CREATE_EVENT'
  | 'GET_EVENT'
  | 'LIST_EVENTS'
  | 'DELETE_EVENT'
  | 'UPDATE_PERMISSION'
  | 'BLOCKED_ACCESS'
  | 'INITIALIZE_DATABASE';

export type AuditResult = 'ALLOWED' | 'DENIED' | 'SUCCESS' | 'ERROR';

export interface EventRecord {
  id: string;
  user_id: string;
  timestamp: string;
  type: EventType;
  title: string;
  content: string;
  created_at: string;
}

export type PermissionsMap = Record<EventType, boolean>;

export interface AuditLogRecord {
  id: number;
  user_id: string;
  timestamp: string;
  action: AuditAction;
  event_type: EventType | null;
  result: AuditResult;
  details: string | null;
}
