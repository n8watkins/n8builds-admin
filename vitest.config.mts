import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Each test sets exactly the env it needs.
    unstubEnvs: true,
    unstubGlobals: true,
    restoreMocks: true,
  },
})
