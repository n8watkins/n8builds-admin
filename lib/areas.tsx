import type { IconType } from 'react-icons'
import {
  LuActivity,
  LuBug,
  LuChartLine,
  LuGamepad2,
  LuLayoutDashboard,
  LuListChecks,
  LuListPlus,
  LuMail,
  LuMousePointerClick,
  LuRocket,
  LuSend,
  LuShieldCheck,
  LuStar,
  LuTimer,
  LuWorkflow,
} from 'react-icons/lu'

/**
 * Every area of the dashboard: its page, icon, colour, and the plain-language
 * context shown on its Overview card and at the top of its page.
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
  | 'setup'

export type Area = {
  id: AreaId
  href: string
  label: string
  icon: IconType
  accent: Accent
  /** One or two sentences for the Overview card. */
  summary: string
  /** The page's "What this is" facts, one sentence each. */
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
    summary: 'The automated checks GitHub runs on every push. Red means the latest run on a main branch failed.',
    about: [
      'CI (GitHub Actions) runs each repo\'s tests, lint, builds and scheduled jobs (nightly checks, backups) on GitHub\'s machines.',
      'A red main branch means the live site may be running broken code, or a scheduled job has stopped working.',
      'Public repos run free, so these never cost Actions minutes.',
    ],
  },
  minutes: {
    id: 'minutes',
    href: '/minutes',
    label: 'Actions minutes',
    icon: LuTimer,
    accent: accent.indigo,
    summary: 'GitHub\'s free CI time for private repos: 2,000 minutes a month per account, reset at the start of each month.',
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
    summary: 'Stars and GitHub repo traffic (views and clones) for the public builds.',
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
    summary: 'Tagged versions of each build and what is live on Cloudflare Workers.',
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
    summary: 'Dependabot warns when a dependency has a known vulnerability. Alerts are on for every build repo.',
    about: [
      'Dependabot compares each repo\'s dependencies with GitHub\'s vulnerability database and opens an alert for each match.',
      'Each alert names the vulnerable package and the version that fixes it; Dependabot can open a pull request with the fix.',
      'Critical and high come first: those are worth fixing soon, especially in a deployed site.',
    ],
  },
  demos: {
    id: 'demos',
    href: '/demos',
    label: 'Live demos',
    icon: LuActivity,
    accent: accent.emerald,
    summary: 'OpenPing checks the portfolio\'s Render demos every 12 minutes on weekdays; off-hours they sleep on purpose.',
    about: [
      'Echo, Scout and GeminiGPT run on Render\'s free tier, which puts apps to sleep when idle.',
      'OpenPing, your own uptime monitor, checks them on a schedule and keeps them awake during working hours.',
      'Grey days are scheduled off-hours and don\'t count as downtime.',
    ],
  },
  errors: {
    id: 'errors',
    href: '/errors',
    label: 'Errors',
    icon: LuBug,
    accent: accent.rose,
    summary: 'Errors visitors hit on n8builds.dev and the portfolio, as Sentry records them.',
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
    summary: 'Who visits n8builds.dev: visitors, countries, top pages, referrers and engagement, from Google Analytics.',
    about: [
      'Google Analytics (one property for all of n8builds.dev) counts visitors and what they do.',
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
    summary: 'Who plays the dino catch game on n8builds.dev and the portfolio, and the high scores.',
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
    summary: 'Every app\'s email through Cloudflare: 3,000 a month are included, then $0.35 per 1,000.',
    about: [
      'mailroom is the one Worker that sends every app\'s email through Cloudflare Email Service, with caps per app and bounce handling.',
      'The monthly count comes from Cloudflare\'s delivery events, so apps that still send on their own are counted too.',
      'Addresses are shown masked and no email content is ever stored; every change here is written to an audit log.',
    ],
  },
  waitlist: {
    id: 'waitlist',
    href: '/waitlist',
    label: 'Waitlist',
    icon: LuListPlus,
    accent: accent.cyan,
    summary: 'Who joined the waitlist on n8builds.dev/upcoming, and for which projects.',
    about: [
      'Sign-ups confirm by email (double opt-in); unconfirmed ones expire after 7 days.',
      'Every waitlist email has a leave link that deletes the entry; Delete here does the same.',
      'Stored in its own database, n8builds-waitlist, which n8builds-web writes and this dashboard only reads.',
    ],
  },
  setup: {
    id: 'setup',
    href: '/setup',
    label: 'Setup',
    icon: LuListChecks,
    accent: accent.slate,
    summary: 'Everything to create once so every page shows live data.',
    about: [],
  },
}

export const NAV_GROUPS: { title?: string; areas: AreaId[] }[] = [
  { areas: ['overview'] },
  { title: 'GitHub', areas: ['ci', 'minutes', 'repos', 'releases', 'security'] },
  { title: 'Sites', areas: ['demos', 'errors', 'traffic', 'mailroom'] },
  { title: 'Counters', areas: ['referrals', 'contact', 'game'] },
  { title: 'People', areas: ['waitlist'] },
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
