import { db } from '../../db/mysql.js';

type LogAuditEventInput = {
  actorUserId?: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  metadata?: unknown;
};

const parseRetentionDays = (): number | null => {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS?.trim();
  if (!raw) {
    return 90;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.floor(parsed);
};

/** Deletes audit rows older than AUDIT_LOG_RETENTION_DAYS (default 90). Set to 0 to disable. */
export const purgeOldAuditLogs = async (): Promise<number> => {
  const retentionDays = parseRetentionDays();
  if (retentionDays === null) {
    return 0;
  }
  const [result] = await db.execute(
    `
      DELETE FROM audit_logs
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `,
    [retentionDays],
  );
  return typeof result.affectedRows === 'number' ? result.affectedRows : 0;
};

export const logAuditEvent = async (input: LogAuditEventInput): Promise<void> => {
  await db.execute(
    `
      INSERT INTO audit_logs (
        actor_user_id,
        actor_email,
        action,
        entity_type,
        entity_id,
        before_state,
        after_state,
        metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.actorUserId ? Number(input.actorUserId) : null,
      input.actorEmail.trim().toLowerCase(),
      input.action,
      input.entityType,
      input.entityId,
      input.beforeState !== undefined ? JSON.stringify(input.beforeState) : null,
      input.afterState !== undefined ? JSON.stringify(input.afterState) : null,
      input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
    ],
  );
};
