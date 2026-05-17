import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { CircleUserRound, ChevronDown } from 'lucide-react';
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

const LogoutWrap = styled.div`
  position: relative;
`;

const LogoutTrigger = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const LogoutMenu = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 200px;
  padding: ${spacing.xs};
  border: 1px solid ${colors.border};
  border-radius: ${radii.sm};
  background: ${colors.surface};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
`;

const LogoutMenuItem = styled.button`
  display: block;
  width: 100%;
  border: 0;
  border-radius: ${radii.sm};
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
  text-align: left;
  color: ${colors.textPrimary};
  background: transparent;
  cursor: pointer;

  &:hover {
    background: ${colors.background};
  }

  &:focus-visible {
    outline: 2px solid ${colors.primary};
    outline-offset: 1px;
  }
`;

const LogoutMenuHint = styled.span`
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: ${colors.textMuted};
  font-weight: 400;
`;

export const UserMenu = (): JSX.Element => {
  const { user, logout, logoutAllDevices } = useAuth();
  const location = useLocation();
  const [logoutMenuOpen, setLogoutMenuOpen] = useState(false);
  const logoutWrapRef = useRef<HTMLDivElement>(null);
  const onAccountPage = location.pathname === ACCOUNT_SETTINGS_PATH;

  useEffect(() => {
    if (!logoutMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent): void => {
      if (logoutWrapRef.current && !logoutWrapRef.current.contains(event.target as Node)) {
        setLogoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [logoutMenuOpen]);

  if (!user) {
    return <></>;
  }

  const handleLogoutThisDevice = (): void => {
    setLogoutMenuOpen(false);
    void logout();
  };

  const handleLogoutAllDevices = (): void => {
    setLogoutMenuOpen(false);
    void logoutAllDevices();
  };

  return (
    <Wrapper>
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
      <LogoutWrap ref={logoutWrapRef}>
        <LogoutTrigger
          type="button"
          $variant="secondary"
          $size="sm"
          aria-expanded={logoutMenuOpen}
          aria-haspopup="menu"
          onClick={() => setLogoutMenuOpen((open) => !open)}
        >
          Log out
          <ChevronDown size={14} aria-hidden />
        </LogoutTrigger>
        {logoutMenuOpen ? (
          <LogoutMenu role="menu">
            <LogoutMenuItem type="button" role="menuitem" onClick={handleLogoutThisDevice}>
              Log out on this device
            </LogoutMenuItem>
            <LogoutMenuItem type="button" role="menuitem" onClick={handleLogoutAllDevices}>
              Log out everywhere
              <LogoutMenuHint>Ends sessions on all browsers and devices</LogoutMenuHint>
            </LogoutMenuItem>
          </LogoutMenu>
        ) : null}
      </LogoutWrap>
    </Wrapper>
  );
};
