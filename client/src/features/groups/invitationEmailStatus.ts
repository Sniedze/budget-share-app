import type { InvitationEmailDeliveryStatus } from '../../graphql/generated/graphql';

export type InvitationEmailDeliveryStatusLabel = InvitationEmailDeliveryStatus;

export const canResendInvitationEmail = (
  status: InvitationEmailDeliveryStatusLabel | null | undefined,
): boolean =>
  status === 'EmailFailed' ||
  status === 'EmailSkipped' ||
  status === 'PendingEmail' ||
  status == null;

export const invitationEmailStatusLabel = (
  status: InvitationEmailDeliveryStatusLabel | null | undefined,
): string => {
  switch (status) {
    case 'PendingEmail':
      return 'Email pending';
    case 'EmailSent':
      return 'Email sent';
    case 'EmailFailed':
      return 'Email failed';
    case 'EmailSkipped':
      return 'Email skipped (SMTP not configured)';
    default:
      return 'Email status unknown';
  }
};
