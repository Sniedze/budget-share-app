import styled from 'styled-components';
import { CircleUserRound } from 'lucide-react';
import { useAuth } from '../../features/auth';
import { colors, spacing } from '../../styles/tokens';
import { Button } from './Button';
import { MutedText } from './Text';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

export const UserMenu = (): JSX.Element => {
  const { user, logout } = useAuth();
  if (!user) {
    return <></>;
  }
  return (
    <Wrapper>
      <CircleUserRound size={16} color={colors.textMuted} />
      <MutedText>{user.fullName}</MutedText>
      <Button type="button" $variant="secondary" $size="sm" onClick={logout}>
        Log out
      </Button>
    </Wrapper>
  );
};
