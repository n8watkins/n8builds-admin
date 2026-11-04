import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests against two production servers (build both first: `npm run test:e2e` does):
 *
 * - gate: the normal build (.next), the same build the Worker deploys. It
 *   proves every page and API route is locked without a session, even with
 *   ADMIN_DEV_BYPASS=1 and ADMIN_TEST_AUTH=1 set at runtime.
 * - app: the E2E build (.next-e2e) with the test-only sign-in stub
 *   (lib/auth/test-auth.ts), to check every page as the signed-in owner.
 *   With GITHUB_TOKEN set the GitHub pages show live data; without it they
 *   show their "not connected" states. The specs pass either way.
 *
 * With E2E_REMOTE_URL set (a deployed Worker, or `npm run preview`), only the
 * gate runs, against that URL, and no local server starts (DEPLOY.md).
 */
const GATE_PORT = 3834
const APP_PORT = 3835
const remote = process.env.E2E_REMOTE_URL

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 4,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
  projects: remote
    ? [{ name: 'gate', testMatch: /gate\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: remote } }]
    : [
        { name: 'gate', testMatch: /gate\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${GATE_PORT}` } },
        { name: 'app', testIgnore: /gate\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: `http://localhost:${APP_PORT}` } },
      ],
  webServer: remote ? [] : [
    {
      command: `node_modules/.bin/next start -p ${GATE_PORT}`,
      // IPv6 loopback: under WSL a connect to a closed 127.0.0.1 port can hang for minutes instead of
      // being refused, which stalled Playwright's "is the port free?" check.
      url: `http://[::1]:${GATE_PORT}/robots.txt`,
      reuseExistingServer: false,
      timeout: 60_000,
      // Both bypass switches on at runtime: a normal build must ignore them.
      env: { ADMIN_DEV_BYPASS: '1', ADMIN_TEST_AUTH: '1', ADMIN_E2E_BUILD: '' },
    },
    {
      // The panels read local D1 databases (wrangler's simulation): create their tables first.
      command: `node scripts/db-local.mjs && node_modules/.bin/next start -p ${APP_PORT}`,
      url: `http://[::1]:${APP_PORT}/robots.txt`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ADMIN_E2E_BUILD: '1', ADMIN_TEST_AUTH: '1' },
    },
  ],
})
