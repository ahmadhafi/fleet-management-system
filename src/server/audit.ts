import type { AppDatabase } from './db.ts';

export interface AuditActor {
  id?: number | null;
  group_username?: string | null;
  role?: string | null;
}

export function recordAudit(
  db: AppDatabase,
  actor: AuditActor | null | undefined,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  previousValues?: unknown,
  newValues?: unknown,
  metadata?: unknown
): void {
  db.prepare(`
    INSERT INTO audit_events (
      actor_user_id, actor_username, actor_role, action, entity_type, entity_id,
      previous_values_json, new_values_json, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    actor?.id ?? null,
    actor?.group_username ?? 'anonymous',
    actor?.role ?? 'NONE',
    action,
    entityType,
    entityId !== undefined && entityId !== null ? String(entityId) : null,
    previousValues !== undefined ? JSON.stringify(previousValues) : null,
    newValues !== undefined ? JSON.stringify(newValues) : null,
    metadata !== undefined ? JSON.stringify(metadata) : null
  );
}
