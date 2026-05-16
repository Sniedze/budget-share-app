import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { isUnauthenticatedGraphqlError, type GraphqlErrorShape } from './graphqlErrorCodes';

const DEFAULT_GRAPHQL_URL = 'http://localhost:4000/graphql';

/** In dev, prefer the local API unless explicitly configured. Production Docker uses `/graphql` via .env. */
const resolveGraphqlUrl = (): string => {
  const configured = import.meta.env.VITE_GRAPHQL_URL?.trim();
  if (import.meta.env.DEV) {
    if (configured && configured.startsWith('http')) {
      return configured;
    }
    return DEFAULT_GRAPHQL_URL;
  }
  return configured || DEFAULT_GRAPHQL_URL;
};

const GRAPHQL_URL = resolveGraphqlUrl();

const toFetchErrorMessage = (error: unknown): string => {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return `Cannot reach the API at ${GRAPHQL_URL}. Start it with: npm run server`;
  }
  return error instanceof Error ? error.message : 'Request failed.';
};

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
    return Boolean(body.errors?.some((error) => isUnauthenticatedGraphqlError(error)));
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
  let initialResponse: Response;
  try {
    initialResponse = await fetch(input, requestInit);
  } catch (error) {
    throw new Error(toFetchErrorMessage(error));
  }

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
