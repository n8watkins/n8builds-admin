// An E2E build (`npm run build:e2e`) compiles in the test-only sign-in stub
// (lib/auth/test-auth.ts) for Lighthouse and E2E runs. It can never be
// deployed: Vercel builds refuse it, and it writes to .next-e2e, not .next.
const e2eBuild = process.env.ADMIN_E2E_BUILD === '1'
if (e2eBuild && process.env.VERCEL) {
  throw new Error('ADMIN_E2E_BUILD is for local test builds only; never set it on Vercel.')
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
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ]
  },
}

export default nextConfig
