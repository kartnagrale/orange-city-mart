import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/orange-city-mart/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://backend:8080',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
