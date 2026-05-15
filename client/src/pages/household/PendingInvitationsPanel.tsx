import styled from 'styled-components';
import { Badge, MutedText } from '../../components/ui';
import { invitationEmailStatusLabel, type InvitationEmailDeliveryStatusLabel } from '../../features/groups/invitationEmailStatus';
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

type PendingInvitationsPanelProps = {
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

export const PendingInvitationsPanel = ({ invitations }: PendingInvitationsPanelProps): JSX.Element | null => {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <Panel>
      <MutedText style={{ margin: 0, fontWeight: 600 }}>Pending household invitations</MutedText>
      {invitations.map((invite) => (
        <InviteRow key={invite.email}>
          <span>
            <strong>{invite.name}</strong> — {invite.email}
          </span>
          <Badge $variant={statusVariant(invite.emailDeliveryStatus)}>
            {invitationEmailStatusLabel(invite.emailDeliveryStatus)}
          </Badge>
        </InviteRow>
      ))}
    </Panel>
  );
};
