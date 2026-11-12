import * as Sentry from '@sentry/nextjs'
import { NextResponse, type NextRequest } from 'next/server'
import { ownerFromRequest } from '@/lib/auth/owner'
import { isSameOriginRequest } from '@/lib/auth/same-origin'
import { safeEqual } from '@/lib/auth/tokens'
import { getOrgMinutes, getPersonalMinutes, getRepo, isGitHubConnected } from '@/lib/github'
import { TRACKED_REPOS } from '@/lib/repos'
import { isAdminDbConnected, utcDate, writeSnapshot, type Snapshot } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * The daily snapshot (a Cron Trigger runs it at 06:15 UTC, worker/handlers.ts): stars per repo and
 * this month's Actions minutes, saved in the dashboard's own database
 * (n8builds-admin, `admin_snapshots`, kept 400 days) so the trend panel
 * can show "+3 stars this week" past GitHub's 14-day windows.
 * The cron calls it with `Authorization: Bearer $CRON_SECRET`; the signed-in
 * owner can also run it by hand, by opening the URL (typed, bookmarked or
 * linked from this dashboard). Anyone else gets 401, and a signed-in run
 * started from another site's link gets 403 (lib/auth/same-origin.ts).
 */
function fromCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return !!secret && safeEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)
}

/**
 * Sentry's cron monitor for the scheduled run: a missed, late or failed
 * snapshot emails the owner (sentry.server.config.ts; inert without a DSN).
 */
const MONITOR = 'admin-daily-snapshot'
const MONITOR_CONFIG = {
  schedule: { type: 'crontab', value: '15 6 * * *' },
  timezone: 'Etc/UTC',
  checkinMargin: 30,
  maxRuntime: 5,
} as const

export async function GET(request: NextRequest) {
  const cron = fromCron(request)
  if (!cron && (await ownerFromRequest(request)) === null) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!cron && !isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'cross-site' }, { status: 403 })
  }
  const checkInId = cron ? Sentry.captureCheckIn({ monitorSlug: MONITOR, status: 'in_progress' }, MONITOR_CONFIG) : undefined
  const done = async (status: 'ok' | 'error', problem?: string) => {
    if (problem) Sentry.captureMessage(`Daily snapshot: ${problem}`, 'error')
    if (checkInId) Sentry.captureCheckIn({ checkInId, monitorSlug: MONITOR, status })
    await Sentry.flush(2000)
  }

  try {
    return await snapshot(done)
  } catch (error) {
    Sentry.captureException(error)
    await done('error')
    throw error
  }
}

async function snapshot(done: (status: 'ok' | 'error', problem?: string) => Promise<void>) {
  if (!(await isAdminDbConnected())) {
    await done('error', 'the admin database is not connected')
    return NextResponse.json({ error: 'not-connected', needs: ['ADMIN_DB'] }, { status: 503 })
  }
  if (!isGitHubConnected()) {
    await done('error', 'GITHUB_TOKEN is not set')
    return NextResponse.json({ error: 'not-connected', needs: ['GITHUB_TOKEN'] }, { status: 503 })
  }

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
  await writeSnapshot(snapshot)
  // A partial snapshot is still saved, but a failed GitHub read (an expired or
  // revoked token, usually) is reported, so the gap in the trends gets noticed.
  const failed = [
    ...repos.flatMap(([repo, result]) => (result.ok ? [] : [repo])),
    ...(personal.ok ? [] : ['personal Actions minutes']),
    ...(org.ok ? [] : ['Appturnity Actions minutes']),
  ]
  await done(failed.length ? 'error' : 'ok', failed.length ? `GitHub reads failed: ${failed.join(', ')}` : undefined)
  return NextResponse.json({ ok: true, snapshot }, { headers: { 'Cache-Control': 'no-store' } })
}
