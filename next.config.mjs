// An E2E build (`npm run build:e2e`) compiles in the test-only sign-in stub
// (lib/auth/test-auth.ts) for Lighthouse and E2E runs. It can never be
// deployed: Vercel builds and Cloudflare Worker builds refuse it (OpenNext
// runs `next build` with ADMIN_WORKER_BUILD=1, open-next.config.ts; Workers
// Builds sets WORKERS_CI), and it writes to .next-e2e, not .next.
const e2eBuild = process.env.ADMIN_E2E_BUILD === '1'
if (e2eBuild && (process.env.VERCEL || process.env.ADMIN_WORKER_BUILD || process.env.WORKERS_CI)) {
  throw new Error('ADMIN_E2E_BUILD is for local test builds only; never set it for a Vercel or Cloudflare build.')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Keeps the corner dev badge out of the owner's local preview.
  devIndicators: false,
  distDir: e2eBuild ? '.next-e2e' : '.next',
  // Inlined at build time: "" in every normal build, so the stub compiles away.
  env: { ADMIN_E2E_BUILD: e2eBuild ? '1' : '' },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Private: never indexed, framed, or sent as a referrer.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // HTTPS only, for two years. Vercel adds this itself; the Worker doesn't.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ]
  },
}

export default nextConfig
