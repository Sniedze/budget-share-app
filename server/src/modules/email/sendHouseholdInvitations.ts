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

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

    try {
      await transporter.sendMail({
        from: smtp.from,
        to: invitee.email,
        subject,
        text,
        html,
      });
      logInvitationEmailSent({ to: invitee.email, groupName });
    } catch (err) {
      logInvitationEmailFailed({
        to: invitee.email,
        groupName,
        message: err instanceof Error ? err.message : String(err),
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

    try {
      await transporter.sendMail({
        from: smtp.from,
        to: invitee.email,
        subject,
        text,
        html,
      });
      logInvitationEmailSent({ to: invitee.email, groupName, template: 'invite_pending' });
    } catch (err) {
      logInvitationEmailFailed({
        to: invitee.email,
        groupName,
        message: err instanceof Error ? err.message : String(err),
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

    try {
      await transporter.sendMail({
        from: smtp.from,
        to: member.email,
        subject,
        text,
        html,
      });
      logInvitationEmailSent({ to: member.email, groupName, template: 'member_existing' });
    } catch (err) {
      logInvitationEmailFailed({
        to: member.email,
        groupName,
        message: err instanceof Error ? err.message : String(err),
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
