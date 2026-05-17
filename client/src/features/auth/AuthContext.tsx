import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  CANCEL_PENDING_EMAIL_CHANGE,
  CHANGE_PASSWORD,
  CONFIRM_EMAIL_CHANGE,
  LOGIN,
  LOGOUT,
  LOGOUT_ALL_DEVICES,
  ME,
  REGISTER,
  RESEND_EMAIL_CHANGE_CONFIRMATION,
  UPDATE_PROFILE,
} from './graphql';
import { clearStoredTokens } from './storage';
import type { UpdateProfileParams } from './profileTypes';
import type { AuthMutationData, AuthUser } from '../../graphql/operationTypes';

export type AuthStateContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isAuthenticating: boolean;
};

export type AuthActionsContextValue = {
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (input: UpdateProfileParams) => Promise<AuthUser>;
  confirmEmailChange: (token: string) => Promise<AuthUser>;
  cancelPendingEmailChange: () => Promise<void>;
  resendEmailChangeConfirmation: () => Promise<void>;
};

export type AuthContextValue = AuthStateContextValue & AuthActionsContextValue;

type MeQueryData = {
  me: AuthUser | null;
};

const AuthStateContext = createContext<AuthStateContextValue | undefined>(undefined);
const AuthActionsContext = createContext<AuthActionsContextValue | undefined>(undefined);

const getUserFromAuthMutation = (data: AuthMutationData): AuthUser | null => {
  return data.login?.user ?? data.register?.user ?? data.changePassword?.user ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const client = useApolloClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const {
    data: meData,
    loading: meLoading,
    error: meError,
  } = useQuery<MeQueryData>(ME, {
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
  });

  useEffect(() => {
    if (meError) {
      setUser(null);
      clearStoredTokens();
    }
  }, [meError]);

  /** Prefer mutation-updated user; read `me` synchronously to avoid a render where loading finished but state lags. */
  const resolvedUser = meError ? null : user ?? meData?.me ?? null;

  const [loginMutation, { loading: loginLoading }] = useMutation<AuthMutationData>(LOGIN, { errorPolicy: 'all' });
  const [registerMutation, { loading: registerLoading }] = useMutation<AuthMutationData>(REGISTER, {
    errorPolicy: 'all',
  });
  const [logoutMutation] = useMutation(LOGOUT, { errorPolicy: 'all' });
  const [logoutAllDevicesMutation] = useMutation(LOGOUT_ALL_DEVICES, { errorPolicy: 'all' });
  const [changePasswordMutation, { loading: changePasswordLoading }] = useMutation<AuthMutationData>(
    CHANGE_PASSWORD,
    { errorPolicy: 'all' },
  );
  const [updateProfileMutation, { loading: updateProfileLoading }] = useMutation<{
    updateProfile: AuthUser;
  }>(UPDATE_PROFILE, { errorPolicy: 'all' });
  const [confirmEmailChangeMutation, { loading: confirmEmailChangeLoading }] = useMutation<{
    confirmEmailChange: AuthUser;
  }>(CONFIRM_EMAIL_CHANGE, { errorPolicy: 'all' });
  const [cancelPendingEmailChangeMutation, { loading: cancelPendingEmailChangeLoading }] = useMutation<{
    cancelPendingEmailChange: AuthUser;
  }>(CANCEL_PENDING_EMAIL_CHANGE, { errorPolicy: 'all' });
  const [resendEmailChangeMutation, { loading: resendEmailChangeLoading }] = useMutation<{
    resendEmailChangeConfirmation: AuthUser;
  }>(RESEND_EMAIL_CHANGE_CONFIRMATION, { errorPolicy: 'all' });

  const login = useCallback(
    async (email: string, password: string, remember = true): Promise<void> => {
      const result = await loginMutation({
        variables: { input: { email, password, rememberMe: remember } },
      });
      const nextUser = result.data ? getUserFromAuthMutation(result.data) : null;
      if (!nextUser) {
        throw new Error(result.error?.message ?? 'Login failed.');
      }
      setUser(nextUser);
    },
    [loginMutation],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string): Promise<void> => {
      const result = await registerMutation({ variables: { input: { fullName, email, password } } });
      const nextUser = result.data ? getUserFromAuthMutation(result.data) : null;
      if (!nextUser) {
        throw new Error(result.error?.message ?? 'Registration failed.');
      }
      setUser(nextUser);
    },
    [registerMutation],
  );

  const clearAuthState = useCallback(async (): Promise<void> => {
    clearStoredTokens();
    setUser(null);
    await client.resetStore();
  }, [client]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutMutation();
    } catch {
      // Still clear local state if the network fails
    } finally {
      await clearAuthState();
    }
  }, [clearAuthState, logoutMutation]);

  const logoutAllDevices = useCallback(async (): Promise<void> => {
    try {
      await logoutAllDevicesMutation();
    } catch {
      // Still clear local state if the network fails
    } finally {
      await clearAuthState();
    }
  }, [clearAuthState, logoutAllDevicesMutation]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      const result = await changePasswordMutation({
        variables: { input: { currentPassword, newPassword } },
      });
      const nextUser = result.data ? getUserFromAuthMutation(result.data) : null;
      if (!nextUser) {
        throw new Error(result.error?.message ?? 'Password change failed.');
      }
      setUser(nextUser);
    },
    [changePasswordMutation],
  );

  const updateProfile = useCallback(
    async (input: UpdateProfileParams): Promise<AuthUser> => {
      const result = await updateProfileMutation({
        variables: {
          input: {
            fullName: input.fullName,
            email: input.email,
            phone: input.phone.trim() || null,
            timezone: input.timezone,
            preferredCurrency: input.preferredCurrency,
          },
        },
      });
      const nextUser = result.data?.updateProfile ?? null;
      if (!nextUser) {
        throw new Error(result.error?.message ?? 'Profile update failed.');
      }
      setUser(nextUser);
      return nextUser;
    },
    [updateProfileMutation],
  );

  const confirmEmailChange = useCallback(
    async (token: string): Promise<AuthUser> => {
      const result = await confirmEmailChangeMutation({ variables: { token } });
      const nextUser = result.data?.confirmEmailChange ?? null;
      if (!nextUser) {
        throw new Error(result.error?.message ?? 'Email confirmation failed.');
      }
      await clearAuthState();
      return nextUser;
    },
    [clearAuthState, confirmEmailChangeMutation],
  );

  const cancelPendingEmailChange = useCallback(async (): Promise<void> => {
    const result = await cancelPendingEmailChangeMutation();
    const nextUser = result.data?.cancelPendingEmailChange ?? null;
    if (!nextUser) {
      throw new Error(result.error?.message ?? 'Could not cancel pending email change.');
    }
    setUser(nextUser);
  }, [cancelPendingEmailChangeMutation]);

  const resendEmailChangeConfirmation = useCallback(async (): Promise<void> => {
    const result = await resendEmailChangeMutation();
    const nextUser = result.data?.resendEmailChangeConfirmation ?? null;
    if (!nextUser) {
      throw new Error(result.error?.message ?? 'Could not resend confirmation email.');
    }
    setUser(nextUser);
  }, [resendEmailChangeMutation]);

  const isInitializing = meLoading;

  const stateValue = useMemo<AuthStateContextValue>(
    () => ({
      user: resolvedUser,
      isAuthenticated: Boolean(resolvedUser),
      isInitializing,
      isAuthenticating:
        loginLoading ||
        registerLoading ||
        changePasswordLoading ||
        updateProfileLoading ||
        confirmEmailChangeLoading ||
        cancelPendingEmailChangeLoading ||
        resendEmailChangeLoading,
    }),
    [
      resolvedUser,
      isInitializing,
      loginLoading,
      registerLoading,
      changePasswordLoading,
      updateProfileLoading,
      confirmEmailChangeLoading,
      cancelPendingEmailChangeLoading,
      resendEmailChangeLoading,
    ],
  );

  const actionsValue = useMemo<AuthActionsContextValue>(
    () => ({
      login,
      register,
      logout,
      logoutAllDevices,
      changePassword,
      updateProfile,
      confirmEmailChange,
      cancelPendingEmailChange,
      resendEmailChangeConfirmation,
    }),
    [
      cancelPendingEmailChange,
      changePassword,
      confirmEmailChange,
      login,
      logout,
      logoutAllDevices,
      register,
      resendEmailChangeConfirmation,
      updateProfile,
    ],
  );

  return (
    <AuthStateContext.Provider value={stateValue}>
      <AuthActionsContext.Provider value={actionsValue}>{children}</AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- hooks colocated with provider
export const useAuthState = (): AuthStateContextValue => {
  const context = useContext(AuthStateContext);
  if (!context) {
    throw new Error('useAuthState must be used inside AuthProvider.');
  }
  return context;
};

// eslint-disable-next-line react-refresh/only-export-components -- hooks colocated with provider
export const useAuthActions = (): AuthActionsContextValue => {
  const context = useContext(AuthActionsContext);
  if (!context) {
    throw new Error('useAuthActions must be used inside AuthProvider.');
  }
  return context;
};

/** Combined auth state and actions (most screens). */
// eslint-disable-next-line react-refresh/only-export-components -- useAuth must live beside AuthProvider
export const useAuth = (): AuthContextValue => {
  return { ...useAuthState(), ...useAuthActions() };
};
