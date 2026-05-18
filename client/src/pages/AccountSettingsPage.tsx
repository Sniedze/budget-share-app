import { Bell, Lock, Pencil, Shield, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections/Sidebar';
import {
  AppLayout,
  Button,
  Card,
  ErrorText,
  HeaderRow,
  HeaderText,
  Input,
  MutedText,
  PageSurface,
  SectionSubtitle,
  SectionTitle,
  UserMenu,
} from '../components/ui';
import { ChangePasswordModal } from '../features/auth/ChangePasswordModal';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { PRIVACY_POLICY_PATH } from '../routes';
import {
  getDefaultProfileTimezone,
  getProfileTimezoneOptions,
  PROFILE_CURRENCY_OPTIONS,
} from '../features/auth/profileOptions';
import type { AuthUser } from '../graphql/operationTypes';
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

const FieldLabel = styled.label`
  font-size: 0.8125rem;
  font-weight: 500;
  color: ${colors.textMuted};
`;

const ReadOnlyFieldLabel = styled.span`
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

const ProfileInput = styled(Input)`
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
`;

const ProfileSelect = styled.select`
  font: inherit;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: ${radii.sm};
  border: 1px solid ${colors.border};
  background: ${colors.surface};
  color: ${colors.textPrimary};

  &:focus {
    outline: 2px solid rgba(79, 70, 229, 0.25);
    outline-offset: 1px;
    border-color: ${colors.primary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const EditActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
`;

const PendingEmailBanner = styled.div`
  margin-bottom: ${spacing.lg};
  padding: ${spacing.md} ${spacing.lg};
  border-radius: ${radii.sm};
  background: ${colors.calloutBg};
  border: 1px solid ${colors.calloutBorder};
  color: ${colors.calloutText};
  font-size: 0.875rem;
`;

const PendingEmailActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
  margin-top: ${spacing.sm};
`;

const ProfileSuccessText = styled.p`
  margin: 0 0 ${spacing.lg};
  color: ${colors.success};
  font-size: 0.875rem;
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
  const normalized = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T');
  const date = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const formatTimezoneLabel = (timezone: string): string => timezone.replace(/_/g, ' ');

const syncProfileDrafts = (
  profile: AuthUser,
  setters: {
    setDraftFullName: (value: string) => void;
    setDraftEmail: (value: string) => void;
    setDraftPhone: (value: string) => void;
    setDraftTimezone: (value: string) => void;
    setDraftCurrency: (value: string) => void;
  },
): void => {
  setters.setDraftFullName(profile.fullName);
  setters.setDraftEmail(profile.pendingEmail ?? profile.email);
  setters.setDraftPhone(profile.phone ?? '');
  setters.setDraftTimezone(profile.timezone || getDefaultProfileTimezone());
  setters.setDraftCurrency(profile.preferredCurrency);
};

export const AccountSettingsPage = (): JSX.Element => {
  const { user, updateProfile, cancelPendingEmailChange, resendEmailChangeConfirmation, isAuthenticating } =
    useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [expenseAlerts, setExpenseAlerts] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftFullName, setDraftFullName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftTimezone, setDraftTimezone] = useState(getDefaultProfileTimezone());
  const [draftCurrency, setDraftCurrency] = useState<string>(PROFILE_CURRENCY_OPTIONS[0]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [pendingActionError, setPendingActionError] = useState<string | null>(null);

  const timezoneOptions = useMemo(() => getProfileTimezoneOptions(), []);
  const currencyOptions = useMemo(() => {
    const options = new Set<string>(PROFILE_CURRENCY_OPTIONS);
    if (user?.preferredCurrency) {
      options.add(user.preferredCurrency);
    }
    return [...options];
  }, [user?.preferredCurrency]);

  const memberSince = useMemo(
    () => (user?.createdAt ? formatMemberSince(user.createdAt) : 'Unknown'),
    [user?.createdAt],
  );

  const draftSetters = useMemo(
    () => ({
      setDraftFullName,
      setDraftEmail,
      setDraftPhone,
      setDraftTimezone,
      setDraftCurrency,
    }),
    [],
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    syncProfileDrafts(user, draftSetters);
  }, [user, draftSetters]);

  const startEditingProfile = (): void => {
    if (!user) {
      return;
    }
    syncProfileDrafts(user, draftSetters);
    setProfileError(null);
    setProfileSuccess(null);
    setIsEditingProfile(true);
  };

  const cancelEditingProfile = (): void => {
    if (!user) {
      return;
    }
    syncProfileDrafts(user, draftSetters);
    setProfileError(null);
    setProfileSuccess(null);
    setIsEditingProfile(false);
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const nextEmail = draftEmail.trim();
      const updatedUser = await updateProfile({
        fullName: draftFullName.trim(),
        email: nextEmail,
        phone: draftPhone,
        timezone: draftTimezone,
        preferredCurrency: draftCurrency,
      });
      setIsEditingProfile(false);
      if (!updatedUser.pendingEmail) {
        setProfileSuccess('Profile updated.');
      }
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not save profile.');
    }
  };

  const handleCancelPendingEmail = async (): Promise<void> => {
    setPendingActionError(null);
    try {
      await cancelPendingEmailChange();
      setProfileSuccess(null);
    } catch (error) {
      setPendingActionError(error instanceof Error ? error.message : 'Could not cancel pending email change.');
    }
  };

  const handleResendPendingEmail = async (): Promise<void> => {
    if (!user?.pendingEmail) {
      return;
    }
    setPendingActionError(null);
    try {
      await resendEmailChangeConfirmation();
    } catch (error) {
      setPendingActionError(error instanceof Error ? error.message : 'Could not resend confirmation email.');
    }
  };

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
          <SettingsCard as="form" onSubmit={(event) => void handleProfileSubmit(event)}>
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
              {isEditingProfile ? (
                <EditActions>
                  <OutlineButton type="button" $size="sm" onClick={cancelEditingProfile} disabled={isAuthenticating}>
                    Cancel
                  </OutlineButton>
                  <Button type="submit" $variant="accent" $weight="semibold" disabled={isAuthenticating}>
                    Save Changes
                  </Button>
                </EditActions>
              ) : (
                <Button type="button" $variant="accent" $weight="semibold" onClick={startEditingProfile}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Pencil size={16} aria-hidden />
                    Edit Profile
                  </span>
                </Button>
              )}
            </CardHeaderRow>

            {profileError ? <ErrorText>{profileError}</ErrorText> : null}
            {profileSuccess && !user.pendingEmail ? <ProfileSuccessText>{profileSuccess}</ProfileSuccessText> : null}
            {pendingActionError ? <ErrorText>{pendingActionError}</ErrorText> : null}

            {user.pendingEmail ? (
              <PendingEmailBanner>
                <strong>Confirm your new email.</strong> We sent a link to <strong>{user.pendingEmail}</strong>. Your
                sign-in email is still <strong>{user.email}</strong> until you confirm.
                <PendingEmailActions>
                  <OutlineButton type="button" $size="sm" onClick={() => void handleResendPendingEmail()} disabled={isAuthenticating}>
                    Resend email
                  </OutlineButton>
                  <OutlineButton type="button" $size="sm" onClick={() => void handleCancelPendingEmail()} disabled={isAuthenticating}>
                    Cancel change
                  </OutlineButton>
                </PendingEmailActions>
              </PendingEmailBanner>
            ) : null}

            <FieldGrid>
              <FieldBlock>
                <FieldLabel htmlFor="profile-full-name">Full Name</FieldLabel>
                {isEditingProfile ? (
                  <ProfileInput
                    id="profile-full-name"
                    name="fullName"
                    value={draftFullName}
                    onChange={(event) => setDraftFullName(event.target.value)}
                    autoComplete="name"
                    required
                    disabled={isAuthenticating}
                  />
                ) : (
                  <FieldValue>{user.fullName}</FieldValue>
                )}
              </FieldBlock>
              <FieldBlock>
                <FieldLabel htmlFor="profile-email">Email Address</FieldLabel>
                {isEditingProfile ? (
                  <ProfileInput
                    id="profile-email"
                    name="email"
                    type="email"
                    value={draftEmail}
                    onChange={(event) => setDraftEmail(event.target.value)}
                    autoComplete="email"
                    required
                    disabled={isAuthenticating}
                  />
                ) : (
                  <FieldValue>
                    {user.email}
                    {user.pendingEmail ? (
                      <MutedText style={{ margin: '6px 0 0', fontSize: '0.8125rem' }}>
                        Pending: {user.pendingEmail}
                      </MutedText>
                    ) : null}
                  </FieldValue>
                )}
              </FieldBlock>
              <FieldBlock>
                <FieldLabel htmlFor="profile-phone">Phone Number</FieldLabel>
                {isEditingProfile ? (
                  <ProfileInput
                    id="profile-phone"
                    name="phone"
                    type="tel"
                    value={draftPhone}
                    onChange={(event) => setDraftPhone(event.target.value)}
                    autoComplete="tel"
                    placeholder="Optional"
                    disabled={isAuthenticating}
                  />
                ) : (
                  <FieldValue>{user.phone?.trim() ? user.phone : '—'}</FieldValue>
                )}
              </FieldBlock>
              <FieldBlock>
                <FieldLabel htmlFor="profile-timezone">Timezone</FieldLabel>
                {isEditingProfile ? (
                  <ProfileSelect
                    id="profile-timezone"
                    name="timezone"
                    value={draftTimezone}
                    onChange={(event) => setDraftTimezone(event.target.value)}
                    required
                    disabled={isAuthenticating}
                  >
                    {timezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {formatTimezoneLabel(timezone)}
                      </option>
                    ))}
                  </ProfileSelect>
                ) : (
                  <FieldValue>{formatTimezoneLabel(user.timezone)}</FieldValue>
                )}
              </FieldBlock>
              <FieldBlock>
                <FieldLabel htmlFor="profile-currency">Currency</FieldLabel>
                {isEditingProfile ? (
                  <ProfileSelect
                    id="profile-currency"
                    name="preferredCurrency"
                    value={draftCurrency}
                    onChange={(event) => setDraftCurrency(event.target.value)}
                    required
                    disabled={isAuthenticating}
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </ProfileSelect>
                ) : (
                  <FieldValue>{user.preferredCurrency}</FieldValue>
                )}
              </FieldBlock>
              <FieldBlock>
                <ReadOnlyFieldLabel>Member Since</ReadOnlyFieldLabel>
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

          <MutedText style={{ fontSize: '0.8125rem' }}>
            <Link to={PRIVACY_POLICY_PATH}>Privacy Policy</Link>
          </MutedText>
        </PageStack>
      </PageSurface>
    </AppLayout>
  );
};
