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

export const buildHouseholdMemberInviteEmail = (params: {
  memberName: string;
  memberEmail: string;
  groupName: string;
  actorEmail: string;
  invitationsUrl: string;
  registerUrl: string;
  loginUrl: string;
  hasAccount: boolean;
}): InvitationEmailPayload => {
  const memberName = sanitizeEmailPlainText(params.memberName);
  const groupName = sanitizeEmailPlainText(params.groupName);
  const actorEmail = sanitizeEmailPlainText(params.actorEmail);
  const memberEmail = sanitizeEmailPlainText(params.memberEmail);
  const invitationsUrl = params.invitationsUrl;
  const registerUrl = params.registerUrl;
  const loginUrl = params.loginUrl;

  const subject = `You've been invited to "${groupName}" on BudgetShare`;
  const accountLines = params.hasAccount
    ? [
        'Log in to accept or decline the invitation:',
        loginUrl,
        '',
        'Or open your invitations directly:',
        invitationsUrl,
      ]
    : [
        `Create an account with this email (${memberEmail}) to join automatically after registration:`,
        registerUrl,
        '',
        'After you have an account, you can accept or decline here:',
        invitationsUrl,
      ];

  const text = [
    `Hi ${memberName},`,
    '',
    `${actorEmail} added you to the household "${groupName}" on BudgetShare.`,
    '',
    ...accountLines,
    '',
    'Thanks,',
    'BudgetShare',
  ].join('\n');

  const accountHtml = params.hasAccount
    ? `<p><a href="${escapeHtml(loginUrl)}">Log in</a> or <a href="${escapeHtml(invitationsUrl)}">review your invitations</a> to accept or decline.</p>`
    : `<p><a href="${escapeHtml(registerUrl)}">Register</a> with <strong>${escapeHtml(memberEmail)}</strong>, then <a href="${escapeHtml(invitationsUrl)}">accept or decline</a> the invitation.</p>`;

  const html = `<p>Hi ${escapeHtml(memberName)},</p>
<p><strong>${escapeHtml(actorEmail)}</strong> added you to the household <strong>${escapeHtml(groupName)}</strong> on BudgetShare.</p>
${accountHtml}
<p>Thanks,<br/>BudgetShare</p>`;

  return { subject, text, html };
};

export const buildExpenseGroupAddedEmail = (params: {
  memberName: string;
  groupName: string;
  expenseGroupName: string;
  actorEmail: string;
  invitationsUrl: string;
  loginUrl: string;
}): InvitationEmailPayload => {
  const memberName = sanitizeEmailPlainText(params.memberName);
  const groupName = sanitizeEmailPlainText(params.groupName);
  const expenseGroupName = sanitizeEmailPlainText(params.expenseGroupName);
  const actorEmail = sanitizeEmailPlainText(params.actorEmail);
  const invitationsUrl = params.invitationsUrl;
  const loginUrl = params.loginUrl;

  const subject = `Added to "${expenseGroupName}" in "${groupName}" on BudgetShare`;
  const text = [
    `Hi ${memberName},`,
    '',
    `${actorEmail} added you to the expense group "${expenseGroupName}" in household "${groupName}".`,
    '',
    'Open BudgetShare to view splits and expenses:',
    loginUrl,
    '',
    'If you do not want to participate in this expense group, open invitations after logging in:',
    invitationsUrl,
    '',
    'Thanks,',
    'BudgetShare',
  ].join('\n');

  const html = `<p>Hi ${escapeHtml(memberName)},</p>
<p><strong>${escapeHtml(actorEmail)}</strong> added you to the expense group <strong>${escapeHtml(expenseGroupName)}</strong> in household <strong>${escapeHtml(groupName)}</strong>.</p>
<p><a href="${escapeHtml(loginUrl)}">Open BudgetShare</a> or <a href="${escapeHtml(invitationsUrl)}">manage invitations</a> to opt out of this expense group.</p>
<p>Thanks,<br/>BudgetShare</p>`;

  return { subject, text, html };
};
