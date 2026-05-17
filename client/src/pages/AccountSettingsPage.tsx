import { Bell, Lock, Pencil, Shield, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  Button,
  Card,
  HeaderRow,
  HeaderText,
  MutedText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
  UserMenu,
} from '../components/ui';
import { ChangePasswordModal } from '../features/auth/ChangePasswordModal';
import { useAuth } from '../features/auth';
import { APP_CURRENCY_CODE } from '../format/currency';
import { colors, radii, spacing } from '../styles/tokens';

const PageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const SettingsCard = styled(Card)`
  padding: ${spacing.xl};
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
`;

const CardHeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${spacing.lg};
  margin-bottom: ${spacing.xl};
`;

const CardHeading = styled.div`
  display: flex;
  gap: ${spacing.md};
  align-items: flex-start;
`;

const CardIcon = styled.span<{ $tone?: 'primary' | 'neutral' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${radii.full};
  flex-shrink: 0;
  background: ${({ $tone = 'neutral' }) =>
    $tone === 'primary' ? colors.primaryLighterBg : colors.background};
  color: ${({ $tone = 'neutral' }) =>
    $tone === 'primary' ? colors.primaryLighterText : colors.textMuted};
`;

const CardTitle = styled.h2`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: ${colors.textPrimary};
`;

const CardDescription = styled.p`
  margin: 4px 0 0;
  font-size: 0.875rem;
  color: ${colors.textMuted};
`;

const HeadingText = styled.div``;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${spacing.lg};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const FieldLabel = styled.span`
  font-size: 0.8125rem;
  font-weight: 500;
  color: ${colors.textMuted};
`;

const FieldValue = styled.div`
  padding: 10px 12px;
  border-radius: ${radii.sm};
  background: ${colors.background};
  color: ${colors.textPrimary};
  font-size: 0.9375rem;
`;

const SecurityRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: ${spacing.md} 0;
`;

const SecurityCopy = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.md};
`;

const OutlineButton = styled(Button)`
  background: ${colors.surface};
  color: ${colors.textPrimary};
  border: 1px solid ${colors.border};
  box-shadow: none;

  &:hover {
    background: ${colors.background};
  }
`;

const NotificationRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.lg};
  padding: ${spacing.md} 0;
  border-top: 1px solid ${colors.border};

  &:first-of-type {
    border-top: 0;
    padding-top: 0;
  }
`;

const Toggle = styled.button<{ $isOn: boolean }>`
  position: relative;
  width: 44px;
  height: 24px;
  border: 0;
  border-radius: ${radii.full};
  cursor: pointer;
  background: ${({ $isOn }) => ($isOn ? colors.primary : colors.border)};
  transition: background-color 120ms ease;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: ${({ $isOn }) => ($isOn ? '23px' : '3px')};
    width: 18px;
    height: 18px;
    border-radius: ${radii.full};
    background: ${colors.surface};
    transition: left 120ms ease;
  }
`;

const formatMemberSince = (createdAt: string): string => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const formatTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ');
  } catch {
    return '—';
  }
};

export const AccountSettingsPage = (): JSX.Element => {
  const { user } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [expenseAlerts, setExpenseAlerts] = useState(true);

  const memberSince = useMemo(
    () => (user?.createdAt ? formatMemberSince(user.createdAt) : '—'),
    [user?.createdAt],
  );

  if (!user) {
    return <></>;
  }

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Account Settings</SectionTitle>
            <SectionSubtitle>Manage your profile, preferences, and account security</SectionSubtitle>
          </HeaderText>
          <UserMenu />
        </HeaderRow>

        {showChangePassword ? <ChangePasswordModal onClose={() => setShowChangePassword(false)} /> : null}

        <PageStack>
          <SettingsCard>
            <CardHeaderRow>
              <CardHeading>
                <CardIcon $tone="primary" aria-hidden>
                  <UserRound size={20} />
                </CardIcon>
                <HeadingText>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </HeadingText>
              </CardHeading>
              <Button type="button" $variant="accent" $weight="semibold" disabled title="Profile editing coming soon">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Pencil size={16} aria-hidden />
                  Edit Profile
                </span>
              </Button>
            </CardHeaderRow>

            <FieldGrid>
              <FieldBlock>
                <FieldLabel>Full Name</FieldLabel>
                <FieldValue>{user.fullName}</FieldValue>
              </FieldBlock>
              <FieldBlock>
                <FieldLabel>Email Address</FieldLabel>
                <FieldValue>{user.email}</FieldValue>
              </FieldBlock>
              <FieldBlock>
                <FieldLabel>Phone Number</FieldLabel>
                <FieldValue>—</FieldValue>
              </FieldBlock>
              <FieldBlock>
                <FieldLabel>Timezone</FieldLabel>
                <FieldValue>{formatTimezone()}</FieldValue>
              </FieldBlock>
              <FieldBlock>
                <FieldLabel>Currency</FieldLabel>
                <FieldValue>{APP_CURRENCY_CODE}</FieldValue>
              </FieldBlock>
              <FieldBlock>
                <FieldLabel>Member Since</FieldLabel>
                <FieldValue>{memberSince}</FieldValue>
              </FieldBlock>
            </FieldGrid>
          </SettingsCard>

          <SettingsCard>
            <CardHeaderRow style={{ marginBottom: spacing.md }}>
              <CardHeading>
                <CardIcon aria-hidden>
                  <Shield size={20} />
                </CardIcon>
                <HeadingText>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Manage your password and security settings</CardDescription>
                </HeadingText>
              </CardHeading>
            </CardHeaderRow>

            <SecurityRow>
              <SecurityCopy>
                <CardIcon aria-hidden>
                  <Lock size={18} />
                </CardIcon>
                <HeadingText>
                  <CardTitle style={{ fontSize: '1rem' }}>Password</CardTitle>
                  <CardDescription>Change your password to keep your account secure</CardDescription>
                </HeadingText>
              </SecurityCopy>
              <OutlineButton type="button" $size="sm" onClick={() => setShowChangePassword(true)}>
                Change Password
              </OutlineButton>
            </SecurityRow>
          </SettingsCard>

          <SettingsCard>
            <CardHeaderRow style={{ marginBottom: spacing.md }}>
              <CardHeading>
                <CardIcon aria-hidden>
                  <Bell size={20} />
                </CardIcon>
                <HeadingText>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage how you receive updates</CardDescription>
                </HeadingText>
              </CardHeading>
            </CardHeaderRow>

            <NotificationRow>
              <HeadingText>
                <CardTitle style={{ fontSize: '1rem' }}>Email Notifications</CardTitle>
                <CardDescription>Receive updates about your account and activity</CardDescription>
              </HeadingText>
              <Toggle
                type="button"
                role="switch"
                aria-checked={emailNotifications}
                aria-label="Email notifications"
                $isOn={emailNotifications}
                onClick={() => setEmailNotifications((value) => !value)}
              />
            </NotificationRow>

            <NotificationRow>
              <HeadingText>
                <CardTitle style={{ fontSize: '1rem' }}>Expense Alerts</CardTitle>
                <CardDescription>Get notified when new expenses are added to your groups</CardDescription>
              </HeadingText>
              <Toggle
                type="button"
                role="switch"
                aria-checked={expenseAlerts}
                aria-label="Expense alerts"
                $isOn={expenseAlerts}
                onClick={() => setExpenseAlerts((value) => !value)}
              />
            </NotificationRow>

            <MutedText style={{ marginTop: spacing.md, fontSize: '0.8125rem' }}>
              Notification preferences are saved on this device only.
            </MutedText>
          </SettingsCard>
        </PageStack>
      </PageSurface>
    </AppLayout>
  );
};
