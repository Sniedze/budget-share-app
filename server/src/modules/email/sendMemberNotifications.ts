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
  buildExpenseGroupAddedEmail,
  buildHouseholdMemberInviteEmail,
  type InvitationEmailPayload,
} from './invitationEmailTemplates.js';
import {
  markInvitationsEmailSkipped,
  updateInvitationEmailDeliveryStatus,
} from './invitationEmailStatus.js';
import { getSmtpTransporter } from './smtpTransporter.js';

export type MemberNotifyTarget = {
  email: string;
  name: string;
  hasAccount: boolean;
};

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

const deliverHouseholdInviteEmail = async (
  transporter: ReturnType<typeof getSmtpTransporter>,
  smtpFrom: string,
  groupId: number,
  groupName: string,
  actorEmail: string,
  target: MemberNotifyTarget,
): Promise<void> => {
  const baseUrl = getPublicAppBaseUrl();
  const emailContent = buildHouseholdMemberInviteEmail({
    memberName: target.name,
    memberEmail: target.email,
    groupName,
    actorEmail,
    invitationsUrl: `${baseUrl}/invitations`,
    registerUrl: `${baseUrl}/register`,
    loginUrl: `${baseUrl}/login`,
    hasAccount: target.hasAccount,
  });

  const result = await sendMailWithRetry(transporter, {
    from: smtpFrom,
    to: target.email,
    ...emailContent,
  });

  if (result.ok) {
    await updateInvitationEmailDeliveryStatus(groupId, target.email, 'email_sent');
    logInvitationEmailSent({
      to: target.email,
      groupName,
      template: target.hasAccount ? 'household_invite_existing' : 'household_invite_new',
      attempts: result.attempts,
    });
    return;
  }

  await updateInvitationEmailDeliveryStatus(groupId, target.email, 'email_failed');
  logInvitationEmailFailed({
    to: target.email,
    groupName,
    attempts: result.attempts,
    message: result.message,
  });
};

export const sendHouseholdMemberInviteEmails = async (params: {
  groupId: number;
  groupName: string;
  actorEmail: string;
  targets: MemberNotifyTarget[];
}): Promise<void> => {
  const { groupId, groupName, actorEmail, targets } = params;
  if (targets.length === 0) {
    return;
  }

  if (!isSmtpConfigured()) {
    logInvitationEmailSkipped({
      reason: 'smtp_not_configured',
      recipientCount: targets.length,
      groupName,
      context: 'household_member_invite',
    });
    await markInvitationsEmailSkipped(
      groupId,
      targets.map((target) => target.email),
    );
    return;
  }

  const smtp = getResolvedSmtpSettings()!;
  const transporter = getSmtpTransporter(smtp);
  for (const target of targets) {
    await deliverHouseholdInviteEmail(transporter, smtp.from, groupId, groupName, actorEmail, target);
  }
};

export const queueHouseholdMemberInviteEmails = (params: {
  groupId: number;
  groupName: string;
  actorEmail: string;
  targets: MemberNotifyTarget[];
}): void => {
  void sendHouseholdMemberInviteEmails(params).catch((err) => {
    logInvitationEmailFailed({
      phase: 'unhandled_household_invite_batch',
      message: err instanceof Error ? err.message : String(err),
    });
  });
};

export const sendExpenseGroupAddedEmails = async (params: {
  groupName: string;
  expenseGroupName: string;
  actorEmail: string;
  targets: Array<{ email: string; name: string }>;
}): Promise<void> => {
  const { groupName, expenseGroupName, actorEmail, targets } = params;
  if (targets.length === 0) {
    return;
  }

  if (!isSmtpConfigured()) {
    logInvitationEmailSkipped({
      reason: 'smtp_not_configured',
      recipientCount: targets.length,
      groupName,
      context: 'expense_group_added',
      expenseGroupName,
    });
    return;
  }

  const smtp = getResolvedSmtpSettings()!;
  const transporter = getSmtpTransporter(smtp);
  const baseUrl = getPublicAppBaseUrl();
  const invitationsUrl = `${baseUrl}/invitations`;
  const loginUrl = `${baseUrl}/login`;

  for (const target of targets) {
    const emailContent = buildExpenseGroupAddedEmail({
      memberName: target.name,
      groupName,
      expenseGroupName,
      actorEmail,
      invitationsUrl,
      loginUrl,
    });
    const result = await sendMailWithRetry(transporter, {
      from: smtp.from,
      to: target.email,
      ...emailContent,
    });
    if (result.ok) {
      logInvitationEmailSent({
        to: target.email,
        groupName,
        template: 'expense_group_added',
        expenseGroupName,
        attempts: result.attempts,
      });
    } else {
      logInvitationEmailFailed({
        to: target.email,
        groupName,
        expenseGroupName,
        attempts: result.attempts,
        message: result.message,
      });
    }
  }
};

export const queueExpenseGroupAddedEmails = (params: {
  groupName: string;
  expenseGroupName: string;
  actorEmail: string;
  targets: Array<{ email: string; name: string }>;
}): void => {
  void sendExpenseGroupAddedEmails(params).catch((err) => {
    logInvitationEmailFailed({
      phase: 'unhandled_expense_group_batch',
      message: err instanceof Error ? err.message : String(err),
    });
  });
};
