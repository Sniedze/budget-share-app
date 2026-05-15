export type InvitationEmailDeliveryStatusLabel =
  | 'PendingEmail'
  | 'EmailSent'
  | 'EmailFailed'
  | 'EmailSkipped';

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
