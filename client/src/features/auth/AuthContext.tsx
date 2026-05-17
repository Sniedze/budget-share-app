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
import { LOGIN, LOGOUT, LOGOUT_ALL_DEVICES, ME, REGISTER } from './graphql';
import { hasSessionHintCookie } from './sessionHint';
import { clearStoredTokens } from './storage';
import type { AuthUser } from './types';

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
};

export type AuthContextValue = AuthStateContextValue & AuthActionsContextValue;

type MeQueryData = {
  me: AuthUser | null;
};

type AuthMutationData = {
  login?: { user: AuthUser };
  register?: { user: AuthUser };
};

const AuthStateContext = createContext<AuthStateContextValue | undefined>(undefined);
const AuthActionsContext = createContext<AuthActionsContextValue | undefined>(undefined);

const getUserFromAuthMutation = (data: AuthMutationData): AuthUser | null => {
  return data.login?.user ?? data.register?.user ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const client = useApolloClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const sessionHintPresent = hasSessionHintCookie();
  const {
    data: meData,
    loading: meLoading,
    error: meError,
  } = useQuery<MeQueryData>(ME, {
    skip: !sessionHintPresent,
    fetchPolicy: 'network-only',
    errorPolicy: 'all',
  });

  useEffect(() => {
    if (meData) {
      setUser(meData.me ?? null);
    }
  }, [meData]);

  useEffect(() => {
    if (meError) {
      setUser(null);
      clearStoredTokens();
    }
  }, [meError]);

  const [loginMutation, { loading: loginLoading }] = useMutation<AuthMutationData>(LOGIN, { errorPolicy: 'all' });
  const [registerMutation, { loading: registerLoading }] = useMutation<AuthMutationData>(REGISTER, {
    errorPolicy: 'all',
  });
  const [logoutMutation] = useMutation(LOGOUT, { errorPolicy: 'all' });
  const [logoutAllDevicesMutation] = useMutation(LOGOUT_ALL_DEVICES, { errorPolicy: 'all' });

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

  const isInitializing = sessionHintPresent && meLoading && user === null && !meError;

  const stateValue = useMemo<AuthStateContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      isAuthenticating: loginLoading || registerLoading,
    }),
    [user, isInitializing, loginLoading, registerLoading],
  );

  const actionsValue = useMemo<AuthActionsContextValue>(
    () => ({
      login,
      register,
      logout,
      logoutAllDevices,
    }),
    [login, logout, logoutAllDevices, register],
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
