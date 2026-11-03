/**
 * The local preview's sign-in bypass, for the time before the GitHub OAuth App
 * exists. It admits the owner without signing in, and only when ALL of these
 * hold:
 *
 * - NODE_ENV is `development` (`next dev`). Next.js replaces
 *   `process.env.NODE_ENV` with a string literal at build time, so in a
 *   production build (`next build`, every Vercel and Cloudflare deployment)
 *   the first check compiles to `"production" !== "development"` and the
 *   function always returns false: no runtime variable can turn it back on.
 * - It is not running on a host (belt and braces): not on Vercel (`VERCEL`),
 *   and not on Cloudflare Workers, where wrangler.jsonc sets `APP_ENV`.
 * - ADMIN_DEV_BYPASS is exactly `1`.
 *
 * tests/unit/dev-bypass.test.ts pins all of this, including that the
 * NODE_ENV read stays a literal `process.env.NODE_ENV` the bundler can inline.
 */
export function isDevBypassEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') return false
  if (process.env.VERCEL || process.env.APP_ENV) return false
  return process.env.ADMIN_DEV_BYPASS === '1'
}
