/**
 * The test-only sign-in stub, for Lighthouse and E2E runs against a real
 * production build (`npm run build:e2e`). It admits the owner without signing
 * in, and only when ALL of these hold:
 *
 * - The build is an E2E build. next.config.mjs inlines ADMIN_E2E_BUILD at
 *   build time through its `env` setting: it is "" in every normal build, so
 *   the first check compiles to `"" !== "1"` and the function always returns
 *   false; no runtime variable can turn it back on. An E2E build also writes
 *   to `.next-e2e`, never `.next`, and next.config.mjs refuses to make one on
 *   Vercel at all.
 * - It is not running on Vercel.
 * - ADMIN_TEST_AUTH is exactly `1` when the server starts.
 *
 * tests/unit/test-auth.test.ts pins this, and the postbuild check fails a
 * normal build if the stub survives in it.
 */
export function isTestAuthEnabled(): boolean {
  if (process.env.ADMIN_E2E_BUILD !== '1') return false
  if (process.env.VERCEL) return false
  return process.env.ADMIN_TEST_AUTH === '1'
}
