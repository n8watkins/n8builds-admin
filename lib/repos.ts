/**
 * The repos the dashboard watches: every public repo behind a build on
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
}

export const PERSONAL_ACCOUNT = 'n8watkins'
export const APPTURNITY_ORG = 'Appturnity'

export const TRACKED_REPOS: TrackedRepo[] = [
  { repo: 'n8watkins/n8builds-web', label: 'n8builds.dev', branch: 'main', vercelProject: 'n8builds-web' },
  { repo: 'n8watkins/dev-portfolio', label: 'portfolio.n8builds.dev', branch: 'main', vercelProject: 'portfolio' },
  { repo: 'n8watkins/portfolio-rank', label: 'Portfolio Rank', branch: 'main', vercelProject: 'portfolio-rank' },
  { repo: 'n8watkins/open-ping', label: 'OpenPing', branch: 'main' },
  { repo: 'n8watkins/scribe', label: 'Scribe', branch: 'main', vercelProject: 'scribe' },
  { repo: 'n8watkins/solara', label: 'Solara', branch: 'main' },
  { repo: 'n8watkins/piper-tts', label: 'Piper TTS', branch: 'master' },
  { repo: 'n8watkins/tl-dw', label: 'TL;DW', branch: 'master' },
  { repo: 'n8watkins/tube-vault', label: 'TubeVault', branch: 'master' },
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
