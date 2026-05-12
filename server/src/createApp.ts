import express, { type Express } from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { createGraphqlContext, type GraphqlContext } from './graphql/context.js';
import { checkDbConnection, ensureSchema, migrateSchema } from './db/mysql.js';
import { graphqlRateLimiter } from './middleware/graphqlRateLimit.js';
import { graphqlCsrfGuard } from './middleware/graphqlCsrfGuard.js';
import { assignRequestContext, getCurrentRequestId } from './middleware/requestContext.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createCorsOptions } from './config/corsOptions.js';

const parseMaxRecursiveSelections = (): number | false => {
  const raw = process.env.GRAPHQL_MAX_RECURSIVE_SELECTIONS;
  if (!raw || raw.trim().length == 0) {
    return 30;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
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
  const app = express();
  const apollo = new ApolloServer<GraphqlContext>({
    typeDefs,
    resolvers,
    maxRecursiveSelections: parseMaxRecursiveSelections(),
    formatError(formattedError) {
      return {
        ...formattedError,
        extensions: {
          ...formattedError.extensions,
          requestId: getCurrentRequestId() ?? 'unknown',
        },
      };
    },
  });

  await apollo.start();
  if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  app.use(assignRequestContext);
  app.use(cors(createCorsOptions()));
  const jsonBodyLimit = process.env.JSON_BODY_LIMIT ?? '512kb';
  app.use(express.json({ limit: jsonBodyLimit }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'server' });
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
