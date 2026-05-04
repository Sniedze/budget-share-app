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
import { LOGIN, LOGOUT, ME, REGISTER } from './graphql';
import { clearStoredTokens } from './storage';
import type { AuthUser } from './types';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isAuthenticating: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

type MeQueryData = {
  me: AuthUser | null;
};

type AuthMutationData = {
  login?: { user: AuthUser };
  register?: { user: AuthUser };
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getUserFromAuthMutation = (data: AuthMutationData): AuthUser | null => {
  return data.login?.user ?? data.register?.user ?? null;
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

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutMutation();
    } catch {
      // Still clear local state if the network fails
    } finally {
      clearStoredTokens();
      setUser(null);
      await client.resetStore();
    }
  }, [client, logoutMutation]);

  const isInitializing = meLoading && user === null && !meError;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      isAuthenticating: loginLoading || registerLoading,
      login,
      register,
      logout,
    }),
    [user, isInitializing, loginLoading, registerLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/** Hook for consumers; co-located with provider for a single auth module. */
// eslint-disable-next-line react-refresh/only-export-components -- useAuth must live beside AuthProvider
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
};
