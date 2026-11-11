import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

import fs from 'fs';
import dotenv from 'dotenv';

// Priority: If .env exists in the app root, its values MUST override any container system environment variables
const envPath = path.resolve(import.meta.dirname, './.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

// Ensure base URL is a valid web path (must start with /, http://, or https://)
// Prevents database connection strings (e.g. postgresql://...) passed in environment variables from corrupting built asset URLs
const rawBase = process.env.VITE_BASE_PATH || process.env.BASE_URL || '/';
const safeBase =
  typeof rawBase === 'string' &&
  (rawBase.startsWith('/') || rawBase.startsWith('http://') || rawBase.startsWith('https://'))
    ? rawBase
    : '/';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: safeBase,
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || ''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || ''),
    'import.meta.env.VITE_BASE_PATH': JSON.stringify(safeBase),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
});
