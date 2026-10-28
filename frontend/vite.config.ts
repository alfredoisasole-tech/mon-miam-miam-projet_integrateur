/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, les appels à /api sont envoyés au serveur local : pas de problème de CORS.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  test: { environment: 'jsdom' },
});
