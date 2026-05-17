import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  envDir: '..',
  resolve: {
    alias: {
      '@': path.resolve(clientRoot, 'src'),
    },
  },
  server: {
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          router: ['react-router-dom'],
          apollo: ['@apollo/client'],
          graphql: ['graphql'],
          lucide: ['lucide-react'],
          recharts: ['recharts'],
        },
      },
    },
  },
})
