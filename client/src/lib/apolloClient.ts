import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import {
  getGraphqlErrorCode,
  GraphqlErrorCode,
  type GraphqlErrorShape,
} from './graphqlErrorCodes';

const DEFAULT_GRAPHQL_URL = 'http://localhost:4000/graphql';
const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL?.trim() || DEFAULT_GRAPHQL_URL;

type GraphqlResponseBody = {
  errors?: GraphqlErrorShape[];
};

let refreshInFlight: Promise<boolean> | null = null;

const isAuthErrorResponse = async (response: Response): Promise<boolean> => {
  if (response.status === 401) {
    return true;
  }
  try {
    const body = (await response.clone().json()) as GraphqlResponseBody;
    return Boolean(
      body.errors?.some(
        (error) =>
          getGraphqlErrorCode(error) === GraphqlErrorCode.UNAUTHENTICATED ||
          error.message?.includes('Authentication required'),
      ),
    );
  } catch {
    return false;
  }
};

const refreshSessionViaCookie = async (): Promise<boolean> => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const response = await fetch(GRAPHQL_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'mutation RefreshSession { refreshSession(input: {}) { user { id } } }',
        }),
      });

      if (!response.ok) {
        return false;
      }
      const payload = (await response.json()) as { errors?: GraphqlErrorShape[]; data?: unknown };
      if (payload.errors?.length) {
        return false;
      }
      return Boolean(payload.data);
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};

const authAwareFetch: typeof fetch = async (input, init) => {
  const originalHeaders = new Headers(init?.headers ?? {});

  const requestInit: RequestInit = {
    ...init,
    credentials: 'include',
    headers: originalHeaders,
  };
  const initialResponse = await fetch(input, requestInit);

  const isRefreshRequest =
    typeof requestInit.body === 'string' && requestInit.body.includes('refreshSession');
  if (isRefreshRequest || !(await isAuthErrorResponse(initialResponse))) {
    return initialResponse;
  }

  const refreshed = await refreshSessionViaCookie();
  if (!refreshed) {
    return initialResponse;
  }

  return fetch(input, { ...init, credentials: 'include', headers: originalHeaders });
};

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: GRAPHQL_URL,
    fetch: authAwareFetch,
  }),
  cache: new InMemoryCache(),
});
