import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import {
  clearStoredTokens,
  getAccessToken,
  getRememberMe,
  getRefreshToken,
  setStoredTokens,
} from '../features/auth/storage';

const GRAPHQL_URL = 'http://localhost:4000/graphql';

type GraphqlError = {
  message?: string;
};

type GraphqlResponseBody = {
  errors?: GraphqlError[];
};

let refreshInFlight: Promise<string | null> | null = null;

const isAuthErrorResponse = async (response: Response): Promise<boolean> => {
  if (response.status === 401) {
    return true;
  }
  try {
    const body = (await response.clone().json()) as GraphqlResponseBody;
    return Boolean(body.errors?.some((error) => error.message?.includes('Authentication required')));
  } catch {
    return false;
  }
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearStoredTokens();
    return null;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query:
            'mutation RefreshSession($input: RefreshSessionInput!) { refreshSession(input: $input) { accessToken refreshToken user { id } } }',
          variables: { input: { refreshToken } },
        }),
      });

      if (!response.ok) {
        clearStoredTokens();
        return null;
      }

      const payload = (await response.json()) as {
        data?: {
          refreshSession?: {
            accessToken: string;
            refreshToken: string;
          };
        };
      };
      const session = payload.data?.refreshSession;
      if (!session?.accessToken || !session.refreshToken) {
        clearStoredTokens();
        return null;
      }
      setStoredTokens({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      }, { remember: getRememberMe() });
      return session.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};

const authAwareFetch: typeof fetch = async (input, init) => {
  const originalHeaders = new Headers(init?.headers ?? {});
  const accessToken = getAccessToken();
  if (accessToken) {
    originalHeaders.set('Authorization', `Bearer ${accessToken}`);
  }

  const requestInit: RequestInit = {
    ...init,
    headers: originalHeaders,
  };
  const initialResponse = await fetch(input, requestInit);

  const isRefreshRequest = typeof requestInit.body === 'string' && requestInit.body.includes('refreshSession');
  if (isRefreshRequest || !(await isAuthErrorResponse(initialResponse))) {
    return initialResponse;
  }

  const refreshedAccessToken = await refreshAccessToken();
  if (!refreshedAccessToken) {
    return initialResponse;
  }

  const retryHeaders = new Headers(init?.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${refreshedAccessToken}`);
  return fetch(input, { ...init, headers: retryHeaders });
};

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: GRAPHQL_URL,
    fetch: authAwareFetch,
  }),
  cache: new InMemoryCache(),
});
