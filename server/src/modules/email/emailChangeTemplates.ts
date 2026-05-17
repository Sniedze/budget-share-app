import { sanitizeEmailPlainText } from '../../lib/sanitize.js';
import type { InvitationEmailPayload } from './invitationEmailTemplates.js';

const escapeHtml = (value: string): string =>
  sanitizeEmailPlainText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const buildEmailChangeConfirmationEmail = (params: {
  fullName: string;
  currentEmail: string;
  newEmail: string;
  confirmUrl: string;
}): InvitationEmailPayload => {
  const fullName = sanitizeEmailPlainText(params.fullName);
  const currentEmail = sanitizeEmailPlainText(params.currentEmail);
  const newEmail = sanitizeEmailPlainText(params.newEmail);
  const confirmUrl = params.confirmUrl;

  const subject = 'Confirm your new BudgetShare email address';
  const text = [
    `Hi ${fullName},`,
    '',
    'We received a request to change the email on your BudgetShare account.',
    `Current email: ${currentEmail}`,
    `New email: ${newEmail}`,
    '',
    'Confirm this change by opening the link below (expires in 24 hours):',
    confirmUrl,
    '',
    'If you did not request this, you can ignore this email. Your sign-in email will stay the same.',
    '',
    'Thanks,',
    'BudgetShare',
  ].join('\n');

  const html = `<p>Hi ${escapeHtml(fullName)},</p>
<p>We received a request to change the email on your BudgetShare account.</p>
<p><strong>Current email:</strong> ${escapeHtml(currentEmail)}<br/>
<strong>New email:</strong> ${escapeHtml(newEmail)}</p>
<p><a href="${escapeHtml(confirmUrl)}">Confirm email change</a></p>
<p>If you did not request this, you can ignore this email. Your sign-in email will stay the same.</p>
<p>Thanks,<br/>BudgetShare</p>`;

  return { subject, text, html };
};
