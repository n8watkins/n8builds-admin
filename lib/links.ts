/** The dashboards this one links out to. */
export const VERCEL_TEAM = 'natkins23s-projects'

export const OUTBOUND_LINKS = [
  { label: 'Vercel', href: `https://vercel.com/${VERCEL_TEAM}` },
  { label: 'Sentry', href: process.env.SENTRY_ORG ? `https://${process.env.SENTRY_ORG}.sentry.io/issues/` : 'https://sentry.io' },
  { label: 'Analytics', href: 'https://analytics.google.com/analytics/web/' },
  { label: 'GitHub', href: 'https://github.com/n8watkins' },
  { label: 'n8builds.dev', href: 'https://n8builds.dev' },
] as const
