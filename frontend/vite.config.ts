import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const backend = 'http://127.0.0.1:5000';
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

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      apiPaths.map((p) => [
        p,
        { target: backend, changeOrigin: true },
      ]),
    ),
  },
});
