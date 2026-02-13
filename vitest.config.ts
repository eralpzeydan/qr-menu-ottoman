import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      exclude: [
        'next.config.mjs',
        'playwright.config.ts',
        'postcss.config.js',
        'tailwind.config.ts',
        'playwright-report/**/*',
        'public/**/*',
        'prisma/**/*',
        '.next/**/*',
        'node_modules/**/*',
        '**/*.config.*',
        '**/*.d.ts',
        'app/(public)/**/MenuClient.tsx',
      ],
    },
    setupFiles: ['tests/utils/vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
