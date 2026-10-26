/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Keeps the corner dev badge out of the owner's local preview.
  devIndicators: false,
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
