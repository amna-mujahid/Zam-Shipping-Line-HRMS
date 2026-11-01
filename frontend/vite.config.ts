import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// The backend API runs separately (backend/, default port 4000). In development,
// requests to /api are proxied to it so the browser only talks to one origin.
const API_URL = process.env.API_URL || 'http://localhost:4000';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, '../shared'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: { '/api': API_URL },
    fs: { allow: ['..'] },
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  preview: {
    port: 3000,
    proxy: { '/api': API_URL },
  },
}));
