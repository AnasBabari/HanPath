import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      'scripts/**/*.{test,spec}.{js,mjs,ts}',
      'tests/api/**/*.{test,spec}.{js,ts}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}', 'api/**/*.{ts,js}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'scripts/**',
        'tests/api/**/*.test.ts',
        'e2e/**',
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
      },
    },
  },
});
