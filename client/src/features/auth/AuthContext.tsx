import { useMutation, useQuery } from '@apollo/client/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LOGIN, ME, REGISTER } from './graphql';
import { clearStoredTokens, getStoredTokens, setStoredTokens } from './storage';
import type { AuthPayload, AuthUser } from './types';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isAuthenticating: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

type MeQueryData = {
  me: AuthUser | null;
};

type AuthMutationData = {
  login?: AuthPayload;
  register?: AuthPayload;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getAuthPayloadFromMutation = (data: AuthMutationData): AuthPayload | null => {
  return data.login ?? data.register ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const hasStoredToken = Boolean(getStoredTokens());
  const {
    data: meData,
    loading: meLoading,
    error: meError,
  } = useQuery<MeQueryData>(ME, {
    skip: !hasStoredToken,
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

  const login = useCallback(async (email: string, password: string, remember = true): Promise<void> => {
    const result = await loginMutation({ variables: { input: { email, password } } });
    const payload = result.data ? getAuthPayloadFromMutation(result.data) : null;
    if (!payload) {
      throw new Error(result.error?.message ?? 'Login failed.');
    }
    setStoredTokens(
      { accessToken: payload.accessToken, refreshToken: payload.refreshToken },
      { remember },
    );
    setUser(payload.user);
  }, [loginMutation]);

  const register = useCallback(async (fullName: string, email: string, password: string): Promise<void> => {
    const result = await registerMutation({ variables: { input: { fullName, email, password } } });
    const payload = result.data ? getAuthPayloadFromMutation(result.data) : null;
    if (!payload) {
      throw new Error(result.error?.message ?? 'Registration failed.');
    }
    setStoredTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken });
    setUser(payload.user);
  }, [registerMutation]);

  const logout = useCallback((): void => {
    clearStoredTokens();
    setUser(null);
  }, []);

  const isInitializing = hasStoredToken && meLoading && user === null;

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

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
};
