import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  logLevel: 'error',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: true,
    hmr: {
      host: 'localhost',
      port: 5173,
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
  plugins: [
    react(),
  ]
})