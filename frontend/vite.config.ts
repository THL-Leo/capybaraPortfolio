import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const backend = 'http://127.0.0.1:5000';

/** Flask API paths — must not steal browser navigations to same-path React routes. */
const apiPaths = [
  '/home',
  '/login',
  '/register',
  '/logout',
  '/time',
  '/net-worth',
  '/net-worth-over-time',
  '/investments-over-time',
  '/accounts',
  '/plaid',
  '/spending',
  '/portfolio',
];

/** React Router paths that overlap with API prefixes above. */
const spaPaths = new Set(['/accounts', '/spending', '/login', '/register']);

function apiProxy(): ProxyOptions {
  return {
    target: backend,
    changeOrigin: true,
    bypass(req) {
      const url = req.url?.split('?')[0] ?? '';
      // Browser refresh / direct URL: serve SPA, not Flask JSON.
      if (spaPaths.has(url) || url.startsWith('/accounts/')) {
        const accept = req.headers.accept ?? '';
        if (accept.includes('text/html')) {
          return '/index.html';
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(apiPaths.map((p) => [p, apiProxy()])),
  },
});
