import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vite configuration for the Blank App web client.
// Tailwind CSS v4 is wired in via its first-party Vite plugin (no PostCSS config
// needed). TanStack Router generates src/routeTree.gen.ts from src/routes/
// (file-based routing, ADR-0005) with per-route code splitting.
export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the NestJS backend during local development, so the
    // app is same-origin in dev exactly as in production (nginx does this in
    // the container image). The bundle itself never contains an API URL.
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
