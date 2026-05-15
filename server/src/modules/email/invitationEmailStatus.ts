import { db } from '../../db/mysql.js';

export type InvitationEmailDeliveryStatus =
  | 'pending_email'
  | 'email_sent'
  | 'email_failed'
  | 'email_skipped';

export const updateInvitationEmailDeliveryStatus = async (
  groupId: number,
  email: string,
  status: InvitationEmailDeliveryStatus,
): Promise<void> => {
  await db.execute(
    `
      UPDATE group_invitations
      SET email_delivery_status = ?
      WHERE group_id = ?
        AND email = ?
    `,
    [status, groupId, email.trim().toLowerCase()],
  );
};

export const markInvitationsEmailSkipped = async (groupId: number, emails: string[]): Promise<void> => {
  if (emails.length === 0) {
    return;
  }
  const normalized = emails.map((email) => email.trim().toLowerCase());
  const placeholders = normalized.map(() => '?').join(', ');
  await db.execute(
    `
      UPDATE group_invitations
      SET email_delivery_status = 'email_skipped'
      WHERE group_id = ?
        AND email IN (${placeholders})
    `,
    [groupId, ...normalized],
  );
};
