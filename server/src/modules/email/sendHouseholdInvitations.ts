import {
  getPublicAppBaseUrl,
  getResolvedSmtpSettings,
  isSmtpConfigured,
} from './smtpConfig.js';
import {
  logInvitationEmailFailed,
  logInvitationEmailSent,
  logInvitationEmailSkipped,
} from '../../logger.js';
import {
  buildExistingMemberAddedEmail,
  buildPendingInviteeEmail,
  type InvitationEmailPayload,
} from './invitationEmailTemplates.js';
import {
  markInvitationsEmailSkipped,
  updateInvitationEmailDeliveryStatus,
} from './invitationEmailStatus.js';
import { getSmtpTransporter } from './smtpTransporter.js';

export type HouseholdInvitee = { email: string; name: string };

type EmailSendPayload = InvitationEmailPayload & {
  from: string;
  to: string;
};

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback;
};

const SMTP_RETRY_MAX_ATTEMPTS = parsePositiveInt(process.env.SMTP_RETRY_MAX_ATTEMPTS, 3);
const SMTP_RETRY_BASE_DELAY_MS = parsePositiveInt(process.env.SMTP_RETRY_BASE_DELAY_MS, 300);

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const sendMailWithRetry = async (
  transporter: ReturnType<typeof getSmtpTransporter>,
  payload: EmailSendPayload,
): Promise<{ ok: true; attempts: number } | { ok: false; attempts: number; message: string }> => {
  let lastMessage = 'unknown_smtp_error';
  for (let attempt = 1; attempt <= SMTP_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      await transporter.sendMail(payload);
      return { ok: true, attempts: attempt };
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : String(err);
      if (attempt < SMTP_RETRY_MAX_ATTEMPTS) {
        await sleep(SMTP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
  return { ok: false, attempts: SMTP_RETRY_MAX_ATTEMPTS, message: lastMessage };
};

const deliverInvitationEmail = async (
  transporter: ReturnType<typeof getSmtpTransporter>,
  smtpFrom: string,
  groupId: number,
  invitee: HouseholdInvitee,
  groupName: string,
  emailContent: InvitationEmailPayload,
  logContext?: { template?: string },
): Promise<void> => {
  const result = await sendMailWithRetry(transporter, {
    from: smtpFrom,
    to: invitee.email,
    ...emailContent,
  });
  if (result.ok) {
    await updateInvitationEmailDeliveryStatus(groupId, invitee.email, 'email_sent');
    logInvitationEmailSent({
      to: invitee.email,
      groupName,
      attempts: result.attempts,
      template: logContext?.template,
    });
    return;
  }
  await updateInvitationEmailDeliveryStatus(groupId, invitee.email, 'email_failed');
  logInvitationEmailFailed({
    to: invitee.email,
    groupName,
    attempts: result.attempts,
    message: result.message,
  });
};

/**
 * Sends one email per invitee (non-registered members). Requires SMTP env vars;
 * if unset, logs once and returns without throwing.
 */
export const sendHouseholdInvitationEmails = async (params: {
  groupId: number;
  groupName: string;
  actorEmail: string;
  invitees: HouseholdInvitee[];
}): Promise<void> => {
  const { groupId, groupName, actorEmail, invitees } = params;
  if (invitees.length === 0) {
    return;
  }

  if (!isSmtpConfigured()) {
    logInvitationEmailSkipped({
      reason: 'smtp_not_configured',
      recipientCount: invitees.length,
      groupName,
    });
    await markInvitationsEmailSkipped(
      groupId,
      invitees.map((invitee) => invitee.email),
    );
    return;
  }

  const smtp = getResolvedSmtpSettings()!;
  const transporter = getSmtpTransporter(smtp);
  const baseUrl = getPublicAppBaseUrl();
  const registerUrl = `${baseUrl}/register`;
  const loginUrl = `${baseUrl}/login`;

  for (const invitee of invitees) {
    const emailContent = buildPendingInviteeEmail({
      inviteeName: invitee.name,
      inviteeEmail: invitee.email,
      groupName,
      actorEmail,
      registerUrl,
      loginUrl,
    });
    await deliverInvitationEmail(transporter, smtp.from, groupId, invitee, groupName, emailContent);
  }
};

/** Fire-and-forget after DB commit so HTTP latency is not tied to SMTP. */
export const queueHouseholdInvitationEmails = (params: {
  groupId: number;
  groupName: string;
  actorEmail: string;
  invitees: HouseholdInvitee[];
}): void => {
  void sendHouseholdInvitationEmails(params).catch((err) => {
    logInvitationEmailFailed({
      phase: 'unhandled_batch',
      message: err instanceof Error ? err.message : String(err),
    });
  });
};

/**
 * When a **new** household is created: email pending invitees (no account yet) plus existing
 * members other than the creator.
 */
export const sendNewGroupCreatedEmails = async (params: {
  groupId: number;
  groupName: string;
  actorEmail: string;
  pendingInvitees: HouseholdInvitee[];
  existingMembersToNotify: HouseholdInvitee[];
}): Promise<void> => {
  const { groupId, groupName, actorEmail, pendingInvitees, existingMembersToNotify } = params;
  const total = pendingInvitees.length + existingMembersToNotify.length;
  if (total === 0) {
    return;
  }

  if (!isSmtpConfigured()) {
    logInvitationEmailSkipped({
      reason: 'smtp_not_configured',
      recipientCount: total,
      groupName,
      context: 'new_group_created',
    });
    await markInvitationsEmailSkipped(
      groupId,
      pendingInvitees.map((invitee) => invitee.email),
    );
    return;
  }

  const smtp = getResolvedSmtpSettings()!;
  const transporter = getSmtpTransporter(smtp);
  const baseUrl = getPublicAppBaseUrl();
  const registerUrl = `${baseUrl}/register`;
  const loginUrl = `${baseUrl}/login`;

  for (const invitee of pendingInvitees) {
    const emailContent = buildPendingInviteeEmail({
      inviteeName: invitee.name,
      inviteeEmail: invitee.email,
      groupName,
      actorEmail,
      registerUrl,
      loginUrl,
    });
    await deliverInvitationEmail(transporter, smtp.from, groupId, invitee, groupName, emailContent, {
      template: 'invite_pending',
    });
  }

  for (const member of existingMembersToNotify) {
    const emailContent = buildExistingMemberAddedEmail({
      memberName: member.name,
      groupName,
      actorEmail,
      loginUrl,
    });
    const result = await sendMailWithRetry(transporter, {
      from: smtp.from,
      to: member.email,
      ...emailContent,
    });
    if (result.ok) {
      logInvitationEmailSent({
        to: member.email,
        groupName,
        template: 'member_existing',
        attempts: result.attempts,
      });
    } else {
      logInvitationEmailFailed({
        to: member.email,
        groupName,
        attempts: result.attempts,
        message: result.message,
      });
    }
  }
};

export const queueNewGroupCreatedEmails = (params: {
  groupId: number;
  groupName: string;
  actorEmail: string;
  pendingInvitees: HouseholdInvitee[];
  existingMembersToNotify: HouseholdInvitee[];
}): void => {
  void sendNewGroupCreatedEmails(params).catch((err) => {
    logInvitationEmailFailed({
      phase: 'unhandled_new_group_batch',
      message: err instanceof Error ? err.message : String(err),
    });
  });
};
