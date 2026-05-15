import { sanitizeEmailPlainText } from '../../lib/sanitize.js';

export type InvitationEmailPayload = {
  subject: string;
  text: string;
  html: string;
};

const escapeHtml = (value: string): string =>
  sanitizeEmailPlainText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildPendingInviteeEmail = (params: {
  inviteeName: string;
  inviteeEmail: string;
  groupName: string;
  actorEmail: string;
  registerUrl: string;
  loginUrl: string;
}): InvitationEmailPayload => {
  const inviteeName = sanitizeEmailPlainText(params.inviteeName);
  const groupName = sanitizeEmailPlainText(params.groupName);
  const actorEmail = sanitizeEmailPlainText(params.actorEmail);
  const inviteeEmail = sanitizeEmailPlainText(params.inviteeEmail);
  const registerUrl = params.registerUrl;
  const loginUrl = params.loginUrl;

  const subject = `You're invited to "${groupName}" on BudgetShare`;
  const text = [
    `Hi ${inviteeName},`,
    '',
    `You've been added as a member of "${groupName}" on BudgetShare.`,
    `Invited by: ${actorEmail}`,
    '',
    `If you don't have an account yet, register with this email address (${inviteeEmail}) so your invitation is accepted automatically:`,
    registerUrl,
    '',
    `If you already have an account, log in with the same email:`,
    loginUrl,
    '',
    'Thanks,',
    'BudgetShare',
  ].join('\n');

  const html = `<p>Hi ${escapeHtml(inviteeName)},</p>
<p>You've been added as a member of <strong>${escapeHtml(groupName)}</strong> on BudgetShare.</p>
<p>Invited by: ${escapeHtml(actorEmail)}</p>
<p>If you don't have an account yet, <a href="${escapeHtml(registerUrl)}">register</a> with this email address (<strong>${escapeHtml(inviteeEmail)}</strong>) so your invitation is accepted automatically.</p>
<p>If you already have an account, <a href="${escapeHtml(loginUrl)}">log in</a> with the same email.</p>
<p>Thanks,<br/>BudgetShare</p>`;

  return { subject, text, html };
};

export const buildExistingMemberAddedEmail = (params: {
  memberName: string;
  groupName: string;
  actorEmail: string;
  loginUrl: string;
}): InvitationEmailPayload => {
  const memberName = sanitizeEmailPlainText(params.memberName);
  const groupName = sanitizeEmailPlainText(params.groupName);
  const actorEmail = sanitizeEmailPlainText(params.actorEmail);
  const loginUrl = params.loginUrl;

  const subject = `You've been added to "${groupName}" on BudgetShare`;
  const text = [
    `Hi ${memberName},`,
    '',
    `${actorEmail} created "${groupName}" on BudgetShare and added you as a member.`,
    '',
    'Open the app to see it:',
    loginUrl,
    '',
    'Thanks,',
    'BudgetShare',
  ].join('\n');

  const html = `<p>Hi ${escapeHtml(memberName)},</p>
<p><strong>${escapeHtml(actorEmail)}</strong> created <strong>${escapeHtml(groupName)}</strong> on BudgetShare and added you as a member.</p>
<p><a href="${escapeHtml(loginUrl)}">Open BudgetShare</a></p>
<p>Thanks,<br/>BudgetShare</p>`;

  return { subject, text, html };
};
