import './loadEnv.js';
import { createHttpApp } from './createApp.js';

const PORT = Number(process.env.PORT) || 4000;

createHttpApp()
  .then(({ app }) => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
