/**
 * The repos the dashboard watches: this dashboard's own repo, and every public repo behind a build on
 * n8builds.dev (the builds with a `repo` in n8builds-web's data/builds.tsx),
 * plus the site itself and the developer portfolio.
 * When a build is added there, add its repo here.
 */
export type TrackedRepo = {
  /** `owner/name`. */
  repo: string
  /** What it is on n8builds.dev. */
  label: string
  /**
   * Its default branch, known up front so CI needs one request per repo
   * instead of two in a row (repo info, then its runs).
   */
  branch: 'main' | 'master'
  /** Its Vercel project (team natkins23s-projects), when it deploys there. */
  vercelProject?: string
  /** Where people use it: the live site, or its page on n8builds.dev. */
  site: string
}

export const PERSONAL_ACCOUNT = 'n8watkins'
export const APPTURNITY_ORG = 'Appturnity'

export const TRACKED_REPOS: TrackedRepo[] = [
  { repo: 'n8watkins/n8builds-web', label: 'n8builds.dev', branch: 'main', vercelProject: 'n8builds-web', site: 'https://n8builds.dev' },
  { repo: 'n8watkins/dev-portfolio', label: 'Developer portfolio', branch: 'main', vercelProject: 'portfolio', site: 'https://portfolio.n8builds.dev' },
  { repo: 'n8watkins/portfolio-rank', label: 'Portfolio Rank', branch: 'main', vercelProject: 'portfolio-rank', site: 'https://portfoliorank.vercel.app' },
  { repo: 'n8watkins/open-ping', label: 'OpenPing', branch: 'main', site: 'https://openping.n8builds.dev' },
  { repo: 'n8watkins/scribe', label: 'Scribe', branch: 'main', vercelProject: 'scribe', site: 'https://scribe.n8builds.dev' },
  { repo: 'n8watkins/solara', label: 'Solara', branch: 'main', site: 'https://solara-uv.web.app' },
  { repo: 'n8watkins/voicedock', label: 'VoiceDock', branch: 'master', site: 'https://n8builds.dev/builds/voicedock' },
  { repo: 'n8watkins/tl-dw', label: 'TL;DW', branch: 'master', site: 'https://n8builds.dev/builds/tldw' },
  { repo: 'n8watkins/tube-vault', label: 'TubeVault', branch: 'master', site: 'https://n8builds.dev/builds/tubevault' },
  // This dashboard itself (private): its CI, deploys and Dependabot alerts.
  { repo: 'n8watkins/n8builds-admin', label: 'Admin dashboard', branch: 'main', vercelProject: 'n8builds-admin', site: 'https://admin.n8builds.dev' },
]

/** GitHub Free's included Actions minutes per month, for a personal account and for a free org. */
export const FREE_ACTIONS_MINUTES = 2000

export function shortName(repo: string): string {
  return repo.split('/')[1] ?? repo
}

export const VERCEL_TEAM = 'natkins23s-projects'

export function vercelProjectUrl(repo: string): string | null {
  const project = TRACKED_REPOS.find((tracked) => tracked.repo === repo)?.vercelProject
  return project ? `https://vercel.com/${VERCEL_TEAM}/${project}` : null
}
