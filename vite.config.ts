import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Image grading and sim runs are slow under coverage on shared CI runners.
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      reporter: ['text-summary', 'text'],
      // M1 accept: at least 90% on the rules engine.
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
