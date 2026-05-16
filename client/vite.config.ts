import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '..',
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
