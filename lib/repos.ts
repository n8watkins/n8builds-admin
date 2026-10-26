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
}

export const PERSONAL_ACCOUNT = 'n8watkins'
export const APPTURNITY_ORG = 'Appturnity'

export const TRACKED_REPOS: TrackedRepo[] = [
  { repo: 'n8watkins/n8builds-web', label: 'n8builds.dev' },
  { repo: 'n8watkins/dev-portfolio', label: 'portfolio.n8builds.dev' },
  { repo: 'n8watkins/portfolio-rank', label: 'Portfolio Rank' },
  { repo: 'n8watkins/open-ping', label: 'OpenPing' },
  { repo: 'n8watkins/scribe', label: 'Scribe' },
  { repo: 'n8watkins/solara', label: 'Solara' },
  { repo: 'n8watkins/piper-tts', label: 'Piper TTS' },
  { repo: 'n8watkins/tl-dw', label: 'TL;DW' },
  { repo: 'n8watkins/tube-vault', label: 'TubeVault' },
]

/** GitHub Free's included Actions minutes per month, for a personal account and for a free org. */
export const FREE_ACTIONS_MINUTES = 2000

export function shortName(repo: string): string {
  return repo.split('/')[1] ?? repo
}
