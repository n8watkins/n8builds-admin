import { NextResponse, type NextRequest } from 'next/server'
import { ownerFromRequest } from '@/lib/auth/owner'
import { safeEqual } from '@/lib/auth/tokens'
import { getOrgMinutes, getPersonalMinutes, getRepo, isGitHubConnected } from '@/lib/github'
import { TRACKED_REPOS } from '@/lib/repos'
import { SNAPSHOT_TTL_SECONDS, isStoreConnected, store, utcDate, type Snapshot } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * The daily snapshot (vercel.json runs it at 06:15 UTC): stars per repo and
 * this month's Actions minutes, saved as `snapshot:<date>` so the trend panel
 * can show "+3 stars this week" past GitHub's 14-day windows.
 * Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`; the signed-in
 * owner can also run it by hand. Anyone else gets 401.
 */
async function authorized(request: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (secret && safeEqual(header, `Bearer ${secret}`)) return true
  return (await ownerFromRequest(request)) !== null
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!isStoreConnected()) {
    return NextResponse.json({ error: 'not-connected', needs: ['ANALYTICS_REDIS_REST_URL', 'ANALYTICS_REDIS_REST_TOKEN'] }, { status: 503 })
  }
  if (!isGitHubConnected()) return NextResponse.json({ error: 'not-connected', needs: ['GITHUB_TOKEN'] }, { status: 503 })

  const [repos, personal, org] = await Promise.all([
    Promise.all(TRACKED_REPOS.map(async ({ repo }) => [repo, await getRepo(repo)] as const)),
    getPersonalMinutes(),
    getOrgMinutes(),
  ])
  const snapshot: Snapshot = {
    date: utcDate(new Date()),
    stars: Object.fromEntries(repos.flatMap(([repo, result]) => (result.ok ? [[repo, result.data.stargazers_count]] : []))),
    minutes: { personal: personal.ok ? personal.data.total : null, appturnity: org.ok ? org.data.total : null },
  }
  await store().set(`snapshot:${snapshot.date}`, snapshot, { ex: SNAPSHOT_TTL_SECONDS })
  return NextResponse.json({ ok: true, snapshot }, { headers: { 'Cache-Control': 'no-store' } })
}
