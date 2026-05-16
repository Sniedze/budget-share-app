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

const ProfileIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: ${colors.primaryLighterBg};
  color: ${colors.primaryLighterText};
`;

export const UserMenu = (): JSX.Element => {
  const { user, logout } = useAuth();
  if (!user) {
    return <></>;
  }
  return (
    <Wrapper>
      <ProfileIcon aria-hidden>
        <CircleUserRound size={16} color={colors.primaryLighterText} />
      </ProfileIcon>
      <MutedText>{user.fullName}</MutedText>
      <Button type="button" $variant="secondary" $size="sm" onClick={() => void logout()}>
        Log out
      </Button>
    </Wrapper>
  );
};
