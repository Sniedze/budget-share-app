import nodemailer from 'nodemailer';
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

export type HouseholdInvitee = { email: string; name: string };
type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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
  transporter: nodemailer.Transporter,
  payload: EmailPayload,
): Promise<{ ok: true; attempts: number } | { ok: false; attempts: number; message: string }> => {
  let lastMessage = 'unknown_smtp_error';
  for (let attempt = 1; attempt <= SMTP_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      await transporter.sendMail(payload);
      return { ok: true, attempts: attempt };
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : String(err);
      if (attempt < SMTP_RETRY_MAX_ATTEMPTS) {
        // Exponential backoff: base, 2x, 4x...
        await sleep(SMTP_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
  return { ok: false, attempts: SMTP_RETRY_MAX_ATTEMPTS, message: lastMessage };
};

/**
 * Sends one email per invitee (non-registered members). Requires SMTP env vars;
 * if unset, logs once and returns without throwing.
 */
export const sendHouseholdInvitationEmails = async (params: {
  groupName: string;
  actorEmail: string;
  invitees: HouseholdInvitee[];
}): Promise<void> => {
  const { groupName, actorEmail, invitees } = params;
  if (invitees.length === 0) {
    return;
  }

  if (!isSmtpConfigured()) {
    logInvitationEmailSkipped({
      reason: 'smtp_not_configured',
      recipientCount: invitees.length,
      groupName,
    });
    return;
  }

  const smtp = getResolvedSmtpSettings()!;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const baseUrl = getPublicAppBaseUrl();
  const registerUrl = `${baseUrl}/register`;
  const loginUrl = `${baseUrl}/login`;

  for (const invitee of invitees) {
    const subject = `You're invited to "${groupName}" on BudgetShare`;
    const text = [
      `Hi ${invitee.name},`,
      '',
      `You've been added as a member of the household "${groupName}" on BudgetShare.`,
      `Invited by: ${actorEmail}`,
      '',
      `If you don't have an account yet, register with this email address (${invitee.email}) so your invitation is accepted automatically:`,
      registerUrl,
      '',
      `If you already have an account, log in with the same email:`,
      loginUrl,
      '',
      'Thanks,',
      'BudgetShare',
    ].join('\n');

    const html = `<p>Hi ${escapeHtml(invitee.name)},</p>
<p>You've been added as a member of the household <strong>${escapeHtml(groupName)}</strong> on BudgetShare.</p>
<p>Invited by: ${escapeHtml(actorEmail)}</p>
<p>If you don't have an account yet, <a href="${escapeHtml(registerUrl)}">register</a> with this email address (<strong>${escapeHtml(invitee.email)}</strong>) so your invitation is accepted automatically.</p>
<p>If you already have an account, <a href="${escapeHtml(loginUrl)}">log in</a> with the same email.</p>
<p>Thanks,<br/>BudgetShare</p>`;

    const result = await sendMailWithRetry(transporter, {
      from: smtp.from,
      to: invitee.email,
      subject,
      text,
      html,
    });
    if (result.ok) {
      logInvitationEmailSent({ to: invitee.email, groupName, attempts: result.attempts });
    } else {
      logInvitationEmailFailed({
        to: invitee.email,
        groupName,
        attempts: result.attempts,
        message: result.message,
      });
    }
  }
};

/** Fire-and-forget after DB commit so HTTP latency is not tied to SMTP. */
export const queueHouseholdInvitationEmails = (params: {
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
 * members other than the creator. Uses one SMTP connection when possible.
 */
export const sendNewGroupCreatedEmails = async (params: {
  groupName: string;
  actorEmail: string;
  pendingInvitees: HouseholdInvitee[];
  /** Already-registered members to notify (exclude creator). */
  existingMembersToNotify: HouseholdInvitee[];
}): Promise<void> => {
  const { groupName, actorEmail, pendingInvitees, existingMembersToNotify } = params;
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
    return;
  }

  const smtp = getResolvedSmtpSettings()!;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  const baseUrl = getPublicAppBaseUrl();
  const registerUrl = `${baseUrl}/register`;
  const loginUrl = `${baseUrl}/login`;

  for (const invitee of pendingInvitees) {
    const subject = `You're invited to "${groupName}" on BudgetShare`;
    const text = [
      `Hi ${invitee.name},`,
      '',
      `You've been added as a member of the household "${groupName}" on BudgetShare.`,
      `Invited by: ${actorEmail}`,
      '',
      `If you don't have an account yet, register with this email address (${invitee.email}) so your invitation is accepted automatically:`,
      registerUrl,
      '',
      `If you already have an account, log in with the same email:`,
      loginUrl,
      '',
      'Thanks,',
      'BudgetShare',
    ].join('\n');

    const html = `<p>Hi ${escapeHtml(invitee.name)},</p>
<p>You've been added as a member of the household <strong>${escapeHtml(groupName)}</strong> on BudgetShare.</p>
<p>Invited by: ${escapeHtml(actorEmail)}</p>
<p>If you don't have an account yet, <a href="${escapeHtml(registerUrl)}">register</a> with this email address (<strong>${escapeHtml(invitee.email)}</strong>) so your invitation is accepted automatically.</p>
<p>If you already have an account, <a href="${escapeHtml(loginUrl)}">log in</a> with the same email.</p>
<p>Thanks,<br/>BudgetShare</p>`;

    const result = await sendMailWithRetry(transporter, {
      from: smtp.from,
      to: invitee.email,
      subject,
      text,
      html,
    });
    if (result.ok) {
      logInvitationEmailSent({
        to: invitee.email,
        groupName,
        template: 'invite_pending',
        attempts: result.attempts,
      });
    } else {
      logInvitationEmailFailed({
        to: invitee.email,
        groupName,
        attempts: result.attempts,
        message: result.message,
      });
    }
  }

  for (const member of existingMembersToNotify) {
    const subject = `You've been added to "${groupName}" on BudgetShare`;
    const text = [
      `Hi ${member.name},`,
      '',
      `${actorEmail} created the household "${groupName}" on BudgetShare and added you as a member.`,
      '',
      `Open the app to see it:`,
      loginUrl,
      '',
      'Thanks,',
      'BudgetShare',
    ].join('\n');

    const html = `<p>Hi ${escapeHtml(member.name)},</p>
<p><strong>${escapeHtml(actorEmail)}</strong> created the household <strong>${escapeHtml(groupName)}</strong> on BudgetShare and added you as a member.</p>
<p><a href="${escapeHtml(loginUrl)}">Open BudgetShare</a></p>
<p>Thanks,<br/>BudgetShare</p>`;

    const result = await sendMailWithRetry(transporter, {
      from: smtp.from,
      to: member.email,
      subject,
      text,
      html,
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
