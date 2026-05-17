import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { CircleUserRound } from 'lucide-react';
import { ChangePasswordModal } from '../../features/auth/ChangePasswordModal';
import { useAuth } from '../../features/auth';
import { ACCOUNT_SETTINGS_PATH } from '../../routes';
import { colors, radii, spacing } from '../../styles/tokens';
import { Button } from './Button';
import { MutedText } from './Text';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
`;

const ProfileLink = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  text-decoration: none;
  color: inherit;
  border-radius: ${radii.sm};
  padding: 4px 6px;
  margin: -4px -6px;
  transition: background-color 120ms ease;

  &:hover {
    background: ${colors.background};
  }

  &:focus-visible {
    outline: 2px solid ${colors.primary};
    outline-offset: 2px;
  }

  &.active {
    background: ${colors.primaryLighterBg};
  }
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

const ProfileName = styled(MutedText)`
  margin: 0;
`;

export const UserMenu = (): JSX.Element => {
  const { user, logout, logoutAllDevices } = useAuth();
  const location = useLocation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const onAccountPage = location.pathname === ACCOUNT_SETTINGS_PATH;

  if (!user) {
    return <></>;
  }

  return (
    <Wrapper>
      {showChangePassword ? <ChangePasswordModal onClose={() => setShowChangePassword(false)} /> : null}
      <ProfileLink
        to={ACCOUNT_SETTINGS_PATH}
        aria-label="Account settings"
        className={onAccountPage ? 'active' : undefined}
      >
        <ProfileIcon aria-hidden>
          <CircleUserRound size={16} color={colors.primaryLighterText} />
        </ProfileIcon>
        <ProfileName>{user.fullName}</ProfileName>
      </ProfileLink>
      {!onAccountPage ? (
        <Button type="button" $variant="secondary" $size="sm" onClick={() => setShowChangePassword(true)}>
          Password
        </Button>
      ) : null}
      <Button type="button" $variant="secondary" $size="sm" onClick={() => void logout()}>
        Log out
      </Button>
      <Button type="button" $variant="secondary" $size="sm" onClick={() => void logoutAllDevices()}>
        All devices
      </Button>
    </Wrapper>
  );
};
