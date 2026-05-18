import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { createGraphqlContext, type GraphqlContext } from './graphql/context.js';
import { checkDbConnection, ensureSchema, migrateSchema } from './db/mysql.js';
import { graphqlRateLimiter } from './middleware/graphqlRateLimit.js';
import { graphqlCsrfGuard } from './middleware/graphqlCsrfGuard.js';
import { assignRequestContext } from './middleware/requestContext.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createCorsOptions } from './config/corsOptions.js';
import { formatGraphqlError } from './graphql/formatGraphqlError.js';
import { validateProductionEnv } from './config/validateProductionEnv.js';

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

/** Default high enough for nested queries (e.g. settlements) with Apollo Client `__typename` fields. */
const DEFAULT_MAX_RECURSIVE_SELECTIONS = 100;

const parseMaxRecursiveSelections = (): number | false => {
  const raw = process.env.GRAPHQL_MAX_RECURSIVE_SELECTIONS?.trim();
  if (!raw || raw.length === 0) {
    return DEFAULT_MAX_RECURSIVE_SELECTIONS;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_RECURSIVE_SELECTIONS;
  }
  return Math.floor(parsed);
};

export type HttpServerBundle = {
  app: Express;
  apollo: ApolloServer<GraphqlContext>;
};

/**
 * Builds Express + Apollo GraphQL stack and ensures DB schema. Does not call `listen`.
 */
export const createHttpApp = async (): Promise<HttpServerBundle> => {
  validateProductionEnv();

  const app = express();
  const apollo = new ApolloServer<GraphqlContext>({
    typeDefs,
    resolvers,
    introspection: !isProduction,
    includeStacktraceInErrorResponses: !isProduction,
    maxRecursiveSelections: parseMaxRecursiveSelections(),
    formatError(formattedError) {
      return formatGraphqlError(formattedError);
    },
  });

  await apollo.start();
  if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  app.use(assignRequestContext);
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(cors(createCorsOptions()));
  const jsonBodyLimit = process.env.JSON_BODY_LIMIT ?? '512kb';
  app.use(express.json({ limit: jsonBodyLimit }));

  app.get('/health', async (_req, res) => {
    try {
      await checkDbConnection();
      res.status(200).json({ ok: true, service: 'server', db: 'ok' });
    } catch {
      res.status(503).json({ ok: false, service: 'server', db: 'unavailable' });
    }
  });
  app.use(
    '/graphql',
    graphqlCsrfGuard,
    graphqlRateLimiter,
    expressMiddleware(apollo, {
      context: async ({ req, res }): Promise<GraphqlContext> => createGraphqlContext(req, res),
    }),
  );
  app.use(errorHandler);

  await checkDbConnection();
  await ensureSchema();
  await migrateSchema();

  return { app, apollo };
};
