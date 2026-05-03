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
