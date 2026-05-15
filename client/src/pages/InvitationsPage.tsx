import { useMutation, useQuery } from '@apollo/client/react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  Button,
  Card,
  ErrorText,
  HeaderRow,
  HeaderText,
  MutedText,
  PageSurface,
  SectionTitle,
  UserMenu,
} from '../components/ui';
import {
  ACCEPT_GROUP_INVITATION,
  DECLINE_GROUP_INVITATION,
  GET_MY_INVITATIONS,
  type GroupInvitation,
} from '../features/groups';
import { spacing } from '../styles/tokens';

const InvitationList = styled.div`
  display: grid;
  gap: ${spacing.md};
  margin-top: ${spacing.lg};
`;

const InvitationCard = styled(Card)`
  display: grid;
  gap: ${spacing.sm};
`;

const ActionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

type MyInvitationsData = {
  myInvitations: GroupInvitation[];
};

export const InvitationsPage = (): JSX.Element => {
  const { data, loading, error, refetch } = useQuery<MyInvitationsData>(GET_MY_INVITATIONS);
  const [acceptInvitation, { loading: accepting }] = useMutation(ACCEPT_GROUP_INVITATION, {
    onCompleted: () => refetch(),
  });
  const [declineInvitation, { loading: declining }] = useMutation(DECLINE_GROUP_INVITATION, {
    onCompleted: () => refetch(),
  });
  const invitations = data?.myInvitations ?? [];
  const isMutating = accepting || declining;

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Invitations</SectionTitle>
            <MutedText>Accept or decline household and expense group invitations.</MutedText>
          </HeaderText>
          <UserMenu />
        </HeaderRow>

        {loading ? <MutedText>Loading invitations...</MutedText> : null}
        {error ? <ErrorText>{error.message}</ErrorText> : null}
        {!loading && !error && invitations.length === 0 ? (
          <MutedText>You have no pending invitations.</MutedText>
        ) : null}

        <InvitationList>
          {invitations.map((invitation) => (
            <InvitationCard key={invitation.id}>
              <strong>{invitation.groupName}</strong>
              <MutedText style={{ margin: 0 }}>
                Household invitation for {invitation.email}
              </MutedText>
              <ActionsRow>
                <Button
                  type="button"
                  $variant="accent"
                  disabled={isMutating}
                  onClick={() => acceptInvitation({ variables: { id: invitation.id } })}
                >
                  Accept household
                </Button>
                <Button
                  type="button"
                  $variant="danger"
                  disabled={isMutating}
                  onClick={() => declineInvitation({ variables: { id: invitation.id } })}
                >
                  Decline household
                </Button>
              </ActionsRow>
            </InvitationCard>
          ))}
        </InvitationList>
      </PageSurface>
    </AppLayout>
  );
};
