import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import styled from 'styled-components';
import { Badge, Button, MutedText } from '../../components/ui';
import { GET_GROUPS, RESEND_GROUP_INVITATION } from '../../features/groups/graphql';
import {
  canResendInvitationEmail,
  invitationEmailStatusLabel,
  type InvitationEmailDeliveryStatusLabel,
} from '../../features/groups/invitationEmailStatus';
import type { GroupPendingInvitation } from '../../features/groups';
import { colors, spacing } from '../../styles/tokens';

const Panel = styled.div`
  margin-top: ${spacing.md};
  padding-top: ${spacing.md};
  border-top: 1px solid ${colors.border};
  display: grid;
  gap: ${spacing.sm};
`;

const InviteRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm};
`;

const InviteActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing.sm};
`;

type ResendGroupInvitationData = {
  resendGroupInvitation: GroupPendingInvitation;
};

type PendingInvitationsPanelProps = {
  groupId: string;
  invitations: GroupPendingInvitation[];
};

const statusVariant = (
  status: InvitationEmailDeliveryStatusLabel | undefined,
): 'default' | 'accent' | 'danger' => {
  if (status === 'EmailSent') {
    return 'accent';
  }
  if (status === 'EmailFailed') {
    return 'danger';
  }
  return 'default';
};

export const PendingInvitationsPanel = ({
  groupId,
  invitations,
}: PendingInvitationsPanelProps): JSX.Element | null => {
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [resendInvitation] = useMutation<ResendGroupInvitationData>(RESEND_GROUP_INVITATION, {
    refetchQueries: [{ query: GET_GROUPS }],
  });

  if (invitations.length === 0) {
    return null;
  }

  const onResend = async (email: string): Promise<void> => {
    setResendError(null);
    setResendingEmail(email);
    try {
      await resendInvitation({ variables: { groupId, email } });
    } catch (error) {
      setResendError(error instanceof Error ? error.message : 'Failed to resend invitation email.');
    } finally {
      setResendingEmail(null);
    }
  };

  return (
    <Panel>
      <MutedText style={{ margin: 0, fontWeight: 600 }}>Pending household invitations</MutedText>
      {invitations.map((invite) => (
        <InviteRow key={invite.email}>
          <span>
            <strong>{invite.name}</strong> — {invite.email}
          </span>
          <InviteActions>
            <Badge $variant={statusVariant(invite.emailDeliveryStatus)}>
              {invitationEmailStatusLabel(invite.emailDeliveryStatus)}
            </Badge>
            {canResendInvitationEmail(invite.emailDeliveryStatus) ? (
              <Button
                type="button"
                $variant="secondary"
                $size="sm"
                disabled={resendingEmail !== null}
                onClick={() => void onResend(invite.email)}
              >
                {resendingEmail === invite.email ? 'Sending…' : 'Resend email'}
              </Button>
            ) : null}
          </InviteActions>
        </InviteRow>
      ))}
      {resendError ? <MutedText style={{ margin: 0, color: colors.danger }}>{resendError}</MutedText> : null}
    </Panel>
  );
};
