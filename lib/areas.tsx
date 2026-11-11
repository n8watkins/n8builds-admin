import type { IconType } from 'react-icons'
import {
  LuActivity,
  LuAppWindow,
  LuBug,
  LuChartLine,
  LuGamepad2,
  LuGauge,
  LuLayoutDashboard,
  LuListChecks,
  LuListPlus,
  LuMail,
  LuMousePointerClick,
  LuNewspaper,
  LuRocket,
  LuSend,
  LuShieldCheck,
  LuStar,
  LuTimer,
  LuWorkflow,
} from 'react-icons/lu'

/**
 * Every area of the dashboard: its page, icon, colour, and the plain-language
 * context shown at the top of its page.
 * Tailwind needs literal class names, so each accent spells its classes out.
 */
export type Accent = { text: string; tile: string; bar: string }

const accent = {
  cyan: { text: 'text-cyan-300', tile: 'bg-cyan-400/12 text-cyan-300 ring-cyan-300/20', bar: 'bg-cyan-400' },
  sky: { text: 'text-sky-300', tile: 'bg-sky-400/12 text-sky-300 ring-sky-300/20', bar: 'bg-sky-400' },
  indigo: { text: 'text-indigo-300', tile: 'bg-indigo-400/12 text-indigo-300 ring-indigo-300/20', bar: 'bg-indigo-400' },
  yellow: { text: 'text-yellow-200', tile: 'bg-yellow-300/12 text-yellow-200 ring-yellow-200/20', bar: 'bg-yellow-300' },
  teal: { text: 'text-teal-300', tile: 'bg-teal-400/12 text-teal-300 ring-teal-300/20', bar: 'bg-teal-400' },
  orange: { text: 'text-orange-300', tile: 'bg-orange-400/12 text-orange-300 ring-orange-300/20', bar: 'bg-orange-400' },
  emerald: { text: 'text-emerald-300', tile: 'bg-emerald-400/12 text-emerald-300 ring-emerald-300/20', bar: 'bg-emerald-400' },
  rose: { text: 'text-rose-300', tile: 'bg-rose-400/12 text-rose-300 ring-rose-300/20', bar: 'bg-rose-400' },
  blue: { text: 'text-blue-300', tile: 'bg-blue-400/12 text-blue-300 ring-blue-300/20', bar: 'bg-blue-400' },
  lime: { text: 'text-lime-300', tile: 'bg-lime-400/12 text-lime-300 ring-lime-300/20', bar: 'bg-lime-400' },
  slate: { text: 'text-slate-300', tile: 'bg-slate-400/12 text-slate-200 ring-slate-300/20', bar: 'bg-slate-400' },
} satisfies Record<string, Accent>

export type AreaId =
  | 'overview'
  | 'ci'
  | 'minutes'
  | 'repos'
  | 'releases'
  | 'security'
  | 'demos'
  | 'errors'
  | 'traffic'
  | 'referrals'
  | 'game'
  | 'contact'
  | 'mailroom'
  | 'waitlist'
  | 'newsletter'
  | 'apps'
  | 'cloudflare'
  | 'setup'

export type Area = {
  id: AreaId
  href: string
  label: string
  icon: IconType
  accent: Accent
  /** One short line under the page title. */
  summary: string
  /** The longer explanation, one sentence each, opened on demand under About. */
  about: string[]
}

export const AREAS: Record<AreaId, Area> = {
  overview: {
    id: 'overview',
    href: '/',
    label: 'Overview',
    icon: LuLayoutDashboard,
    accent: accent.cyan,
    summary: 'Everything at a glance, with what needs attention first.',
    about: [],
  },
  ci: {
    id: 'ci',
    href: '/ci',
    label: 'CI',
    icon: LuWorkflow,
    accent: accent.sky,
    summary: 'The latest GitHub Actions run of each workflow on each main branch.',
    about: [
      'CI (GitHub Actions) runs each repo\'s tests, lint, builds and scheduled jobs (nightly checks, backups) on GitHub\'s machines.',
      'A red main branch means the live site may be running broken code, or a scheduled job has stopped working.',
      'A failing run on a main branch shows red, and floats to the top of the Overview.',
      'Public repos run free, so these never cost Actions minutes.',
    ],
  },
  minutes: {
    id: 'minutes',
    href: '/minutes',
    label: 'Actions minutes',
    icon: LuTimer,
    accent: accent.indigo,
    summary: 'Private-repo CI time: 2,000 free minutes a month per account.',
    about: [
      'GitHub Free includes 2,000 Linux CI minutes a month for each account: your personal account and the Appturnity org each have their own.',
      'Public repos (all the n8builds builds) don\'t use them; Appturnity\'s private monorepo-app does.',
      'The Appturnity org pays for anything beyond the free 2,000. With no payment method or a $0 budget, its workflows simply stop until the minutes reset at the start of the next month.',
    ],
  },
  repos: {
    id: 'repos',
    href: '/repos',
    label: 'Stars and traffic',
    icon: LuStar,
    accent: accent.yellow,
    summary: 'Stars, views and clones of the public builds on GitHub.',
    about: [
      'Stars are people bookmarking a repo; views and clones are visits to its GitHub page and downloads of its code.',
      'They show which builds people find on GitHub, beyond n8builds.dev itself.',
      'GitHub keeps only 14 days of traffic, so the daily snapshot keeps the history once it is set up.',
    ],
  },
  releases: {
    id: 'releases',
    href: '/releases',
    label: 'Releases and deploys',
    icon: LuRocket,
    accent: accent.teal,
    summary: 'Tagged versions of each build and what is live on Workers.',
    about: [
      'A release is a tagged version of a build (the weekly release train cuts them for n8builds.dev).',
      'A deploy is a new version going live on the project\'s Cloudflare Worker (or, for a project still on Vercel, Vercel publishing a commit).',
      'A failed deploy means a change never went live.',
    ],
  },
  security: {
    id: 'security',
    href: '/security',
    label: 'Security alerts',
    icon: LuShieldCheck,
    accent: accent.orange,
    summary: 'Dependabot alerts for dependencies with known vulnerabilities.',
    about: [
      'Dependabot compares each repo\'s dependencies with GitHub\'s vulnerability database and opens an alert for each match.',
      'Each alert names the vulnerable package and the version that fixes it; Dependabot can open a pull request with the fix.',
      'Critical and high come first: those are worth fixing soon, especially in a deployed site.',
      'Alerts are on for every build repo; a repo with them off reports nothing.',
    ],
  },
  demos: {
    id: 'demos',
    href: '/demos',
    label: 'Live demos',
    icon: LuActivity,
    accent: accent.emerald,
    summary: 'Uptime of the portfolio\'s Render demos, from OpenPing.',
    about: [
      'Echo, Scout and GeminiGPT run on Render\'s free tier, which puts apps to sleep when idle.',
      'OpenPing, your own uptime monitor, checks them every 12 minutes on weekdays and keeps them awake during working hours; off-hours they sleep on purpose.',
      'Grey days are scheduled off-hours and don\'t count as downtime.',
    ],
  },
  errors: {
    id: 'errors',
    href: '/errors',
    label: 'Errors',
    icon: LuBug,
    accent: accent.rose,
    summary: 'Errors visitors hit on n8builds.dev and the portfolio, from Sentry.',
    about: [
      'Sentry records JavaScript and server errors that real visitors run into, with the page and browser.',
      'New issues usually mean a recent change broke something.',
      'The free plan includes 5,000 errors a month; beyond that Sentry drops them rather than billing.',
    ],
  },
  traffic: {
    id: 'traffic',
    href: '/traffic',
    label: 'Website traffic',
    icon: LuChartLine,
    accent: accent.blue,
    summary: 'Who visits n8builds.dev, from Google Analytics.',
    about: [
      'Google Analytics (one property for all of n8builds.dev) counts visitors, countries, top pages, referrers and engagement.',
      'Top pages and referrers show which builds and posts bring people in, and from where.',
      'AI crawlers aren\'t counted here; Cloudflare\'s AI Crawl Control logs them.',
    ],
  },
  referrals: {
    id: 'referrals',
    href: '/referrals',
    label: 'Referrals to Tech for Pros',
    icon: LuMousePointerClick,
    accent: accent.cyan,
    summary: 'How many visitors n8builds.dev sends to techforpros.com.',
    about: [
      'n8builds.dev links to Tech for Pros from its navbar button and its "Work with me" card.',
      'This counts the clicks on those links, by placement, so you can see which ones work.',
      'Old links to Appturnity (n8builds.dev/appturnity) still redirect there, and are counted apart.',
      'Only daily totals are stored: no IPs, no IDs, no cookies.',
    ],
  },
  game: {
    id: 'game',
    href: '/game',
    label: 'Dino game',
    icon: LuGamepad2,
    accent: accent.lime,
    summary: 'Rounds, players and high scores of the dino catch game.',
    about: [
      'The dino in the AI kit (n8builds.dev) and the tech stack card (the portfolio) is a 30-second catch game.',
      'This counts rounds, players, tries, scores and countries, and keeps the high scores with site, country and date.',
      'Private by design: no cookies or IPs; a player is a hash that changes every day.',
    ],
  },
  contact: {
    id: 'contact',
    href: '/contact',
    label: 'Contact messages',
    icon: LuMail,
    accent: accent.lime,
    summary: 'Messages sent through n8builds.dev\'s contact form.',
    about: [
      'Each message is emailed to you through Cloudflare Email Service; this counts them without opening the inbox.',
      'The form allows 50 verified messages a day.',
      'Only a daily number is stored, never the message.',
    ],
  },
  mailroom: {
    id: 'mailroom',
    href: '/mailroom',
    label: 'Mailroom',
    icon: LuSend,
    accent: accent.sky,
    summary: 'Every app\'s email: usage, caps, bounces and blocked addresses.',
    about: [
      'mailroom is the one Worker that sends every app\'s email through Cloudflare Email Service, with caps per app and bounce handling. The plan includes 3,000 emails a month, then $0.35 per 1,000.',
      'Delivered counts come from Cloudflare\'s delivery events, so apps that still send on their own count too. Mail to your own verified inbox is free, and Cloudflare does not always report it. Today and month are sends through mailroom, which its caps count.',
      'Addresses are shown masked and no email content is ever stored; every change here is written to an audit log.',
    ],
  },
  waitlist: {
    id: 'waitlist',
    href: '/waitlist',
    label: 'Waitlist',
    icon: LuListPlus,
    accent: accent.cyan,
    summary: 'Who joined the waitlist on n8builds.dev/upcoming, by project.',
    about: [
      'Sign-ups confirm by email (double opt-in); unconfirmed ones expire after 7 days.',
      'Every waitlist email has a leave link that deletes the entry; Delete here does the same.',
      'Stored in its own database, n8builds-waitlist, which n8builds-web writes and this dashboard only reads.',
    ],
  },
  newsletter: {
    id: 'newsletter',
    href: '/newsletter',
    label: 'Newsletter',
    icon: LuNewspaper,
    accent: accent.indigo,
    summary: 'Who gets new N8\'s Notions posts by email, and each weekly digest.',
    about: [
      'Readers sign up on n8builds.dev\'s blog and confirm by email (double opt-in); an unconfirmed address expires after 7 days.',
      'A weekly digest goes out when a post was published since the last one, sent through mailroom in small batches; a week that would go past the newsletter\'s monthly email budget is skipped, with the reason.',
      'A long list sends over several days (up to 30 emails a daily run); a digest with no delivery for 26 hours counts as stalled and needs attention.',
      'Every digest has an unsubscribe link that deletes the address. Addresses are shown masked, and links\' tokens are never read.',
      'Stored in n8builds-waitlist beside the waitlist, which n8builds-web writes and this dashboard only reads.',
    ],
  },
  apps: {
    id: 'apps',
    href: '/apps',
    label: 'App stats',
    icon: LuAppWindow,
    accent: accent.teal,
    summary: 'Each app\'s own admin numbers, totals only.',
    about: [
      'Each app with its own admin (NetTrailers first) reports its totals over a service binding, with no public URL and no token.',
      'Totals only: never an email, a name or a per-user row. Every action stays in the app\'s own admin, linked from its card.',
      'The shared shape is in docs/APP-STATS.md.',
    ],
  },
  cloudflare: {
    id: 'cloudflare',
    href: '/cloudflare',
    label: 'Cloudflare usage',
    icon: LuGauge,
    accent: accent.orange,
    summary: 'Workers and Workers AI against what the plan includes, so nothing is ever billed past it.',
    about: [
      'The Workers Paid plan includes 10 million requests and 30 million CPU milliseconds a month for the whole account; past that Cloudflare bills $0.30 per million requests and $0.02 per million CPU ms.',
      'The rule is never to go past them: the Overview raises a chip at 70% of either, red at 90%, whether used so far or projected to the end of the month.',
      'The projection is a straight line from the month so far; it starts counting after the first day, when it stops being noise.',
      'Workers AI is free up to 10,000 neurons a UTC day, and PortfolioRank stops itself at 2,500 of them. Email has its own cap of 2,500 a month, on the Mailroom page.',
      'Numbers come from Cloudflare\'s GraphQL Analytics API, which samples busy traffic and runs a few minutes behind; they refresh every 10 minutes. Requests for static assets are free and not counted.',
    ],
  },
  setup: {
    id: 'setup',
    href: '/setup',
    label: 'Setup',
    icon: LuListChecks,
    accent: accent.slate,
    summary: 'Everything to create once so every page shows live data.',
    about: [
      'Each item shows its status right now: anything not done is under To do.',
      'Put secrets straight into the Cloudflare Worker (npx wrangler secret put) or, locally, into .env.local; never into a chat.',
      'The same list lives in docs/SETUP.md.',
    ],
  },
}

export const NAV_GROUPS: { title?: string; areas: AreaId[] }[] = [
  { areas: ['overview'] },
  { title: 'GitHub', areas: ['ci', 'minutes', 'repos', 'releases', 'security'] },
  { title: 'Sites', areas: ['demos', 'errors', 'traffic', 'mailroom'] },
  // Apps sits beside Sites, and keeps the Overview's five-wide rows full (Sites 4 + Apps 1).
  { title: 'Apps', areas: ['apps'] },
  { title: 'Counters', areas: ['referrals', 'contact', 'game'] },
  { title: 'People', areas: ['waitlist', 'newsletter'] },
  // Its own row on the Overview, beside Setup (Counters 3 + People 2 fill the row above).
  { title: 'Usage', areas: ['cloudflare'] },
  { areas: ['setup'] },
]

export function areaForPath(pathname: string): Area {
  return Object.values(AREAS).find((area) => area.href === pathname) ?? AREAS.overview
}

/** The public sites, linked from the sidebar and the phone menu. */
export const SITES = [
  { label: 'n8builds.dev', href: 'https://n8builds.dev' },
  { label: 'portfolio.n8builds.dev', href: 'https://portfolio.n8builds.dev' },
]
