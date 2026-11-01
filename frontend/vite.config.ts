/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    globals: true, // ← CRUCIAL : rend expect, describe, it disponibles globalement
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'], // ← CRUCIAL : charge jest-dom avant les tests
  },
});