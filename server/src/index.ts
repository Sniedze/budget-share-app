import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const start = async () => {
  const apollo = new ApolloServer({
    typeDefs,
    resolvers,
  });

  await apollo.start();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true, service: 'server' });
  });
  app.use('/graphql', expressMiddleware(apollo));

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });
};

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
