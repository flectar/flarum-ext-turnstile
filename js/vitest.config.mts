import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  tsconfig: './tsconfig.json',
  oxc: {
    jsx: { runtime: 'classic', pragma: 'm', pragmaFrag: 'm.fragment' },
  },
  resolve: {
    alias: {
      'flarum/forum/app': fileURLToPath(new URL('./tests/fixtures/app.ts', import.meta.url)),
      'flarum/common/extend': fileURLToPath(new URL('../vendor/flarum/core/js/src/common/extend.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
