import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { SectionSubtitle, SectionTitle } from './Text';
import { AuthCard, AuthEyebrow, AuthHeader, AuthPage, AuthTabButton, AuthTabs } from './AuthLayout';

type AuthPageShellProps = {
  subtitle: string;
  activeTab: 'login' | 'register';
  children: ReactNode;
};

export const AuthPageShell = ({ subtitle, activeTab, children }: AuthPageShellProps): JSX.Element => {
  return (
    <AuthPage>
      <AuthCard>
        <AuthHeader>
          <AuthEyebrow aria-hidden>💰</AuthEyebrow>
          <SectionTitle>BudgetShare</SectionTitle>
          <SectionSubtitle>{subtitle}</SectionSubtitle>
        </AuthHeader>

        <AuthTabs>
          {activeTab === 'login' ? (
            <AuthTabButton type="button" $active $variant="accent" $weight="semibold">
              <LogIn size={14} /> Login
            </AuthTabButton>
          ) : (
            <AuthTabButton as={Link} to="/login" type="button" $variant="secondary" $weight="semibold">
              <LogIn size={14} /> Login
            </AuthTabButton>
          )}
          {activeTab === 'register' ? (
            <AuthTabButton type="button" $active $variant="accent" $weight="semibold">
              <UserPlus size={14} /> Sign Up
            </AuthTabButton>
          ) : (
            <AuthTabButton as={Link} to="/register" type="button" $variant="secondary" $weight="semibold">
              <UserPlus size={14} /> Sign Up
            </AuthTabButton>
          )}
        </AuthTabs>

        {children}
      </AuthCard>
    </AuthPage>
  );
};
