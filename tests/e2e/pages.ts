/** Every page of the admin, with the heading it must show. */
export const PAGES = [
  { path: '/', heading: 'Overview' },
  { path: '/ci', heading: 'CI' },
  { path: '/minutes', heading: 'Actions minutes' },
  { path: '/repos', heading: 'Stars and traffic' },
  { path: '/releases', heading: 'Releases and deploys' },
  { path: '/security', heading: 'Security alerts' },
  { path: '/demos', heading: 'Live demos' },
  { path: '/errors', heading: 'Errors' },
  { path: '/traffic', heading: 'Website traffic' },
  { path: '/mailroom', heading: 'Mailroom' },
  { path: '/referrals', heading: 'Referrals to Tech for Pros' },
  { path: '/contact', heading: 'Contact messages' },
  { path: '/game', heading: 'Dino game' },
  { path: '/waitlist', heading: 'Waitlist' },
  { path: '/setup', heading: 'Setup' },
] as const
