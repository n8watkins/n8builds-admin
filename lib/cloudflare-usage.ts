import 'server-only'
import { unstable_cache } from 'next/cache'
import { cache } from 'react'
import { fixtureAi, fixtureWorkers } from './cloudflare-usage-fixture'
import { formatNumber, formatPercent } from './format'
import { CLOUDFLARE_ACCOUNT } from './repos'
import { traced } from './trace'

/**
 * Cloudflare usage against the Workers Paid plan's included amounts, so the
 * owner never pays past them: Workers requests and CPU time this month, and
 * Workers AI neurons today. Read from the GraphQL Analytics API with a
 * read-only token (Account, Account Analytics, Read) in CF_ANALYTICS_TOKEN;
 * docs/SETUP.md. Each answer is cached for CACHE_SECONDS so the page never
 * hammers the API.
 */

/**
 * The Workers Paid plan's included amounts (developers.cloudflare.com/workers/platform/pricing,
 * Standard usage model, checked 2026-11-11). They are per account and plan:
 * an Enterprise contract or a future price change can differ, so change them here.
 */
export const WORKERS_INCLUDED = { requests: 10_000_000, cpuMs: 30_000_000 } as const
/** Workers AI's free neurons per UTC day, on the Free and Paid plans alike (workers-ai/platform/pricing). */
export const AI_FREE_NEURONS_PER_DAY = 10_000
/** PortfolioRank's own daily ceiling (its AI_NEURON_CEILING, portfolio-rank wrangler.jsonc). */
export const PORTFOLIORANK_AI_SLICE = 2_500
/** mailroom's all-app monthly email cap, shown on the Mailroom page. */
export const MAILROOM_MONTHLY_CAP = 2_500

/** "Needs attention" at 70% of an allowance (used or projected), red at 90%. */
export const WARN_AT = 0.7
export const BAD_AT = 0.9

/** How long one GraphQL answer is reused. */
export const CACHE_SECONDS = 600

export const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql'

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

export type Level = 'good' | 'warn' | 'bad'

/** A read that can fail; `permission` when the token lacks access (as opposed to an outage). */
export type Read<T> = { ok: true; data: T } | { ok: false; status: number; message: string; permission: boolean }

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)

/** The UTC calendar month `now` falls in: [start, end). */
export function monthWindow(now: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start, end }
}

/** The UTC day `now` falls in starts here (Workers AI's allowance resets at 00:00 UTC). */
export function dayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** The GraphQL API reports CPU time in microseconds; the plan counts milliseconds. */
export function usToMs(us: number): number {
  return us / 1000
}

/** The share of the month gone at `now`, from 0 to 1. */
export function monthElapsed(now: Date): number {
  const { start, end } = monthWindow(now)
  return Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())))
}

/**
 * A straight line from the month so far to its end. In the first hour the
 * line is taken over one hour, so a handful of requests can't project to
 * billions.
 */
export function projectToMonthEnd(used: number, now: Date): number {
  const { start, end } = monthWindow(now)
  const total = end.getTime() - start.getTime()
  const elapsed = Math.min(total, Math.max(HOUR_MS, now.getTime() - start.getTime()))
  return (used * total) / elapsed
}

/** A projection counts towards alerts only after the month's first full day; before that it is too noisy. */
export function projectionReady(now: Date): boolean {
  return now.getTime() - monthWindow(now).start.getTime() >= DAY_MS
}

/**
 * Where an allowance stands: the worse of what is used and (once it counts)
 * what is projected, against 70% and 90%. `basis` says which one tripped it.
 */
export function allowanceLevel(used: number, projected: number | null, included: number): { level: Level; share: number; basis: 'used' | 'projected' } {
  const usedShare = included > 0 ? used / included : 0
  const projectedShare = projected !== null && included > 0 ? projected / included : 0
  const share = Math.max(usedShare, projectedShare)
  const level: Level = share >= BAD_AT ? 'bad' : share >= WARN_AT ? 'warn' : 'good'
  const basis = projectedShare > usedShare ? 'projected' : 'used'
  return { level, share, basis }
}

/** The month's query: requests and CPU time per Worker since the start of the UTC month. */
export function workersQuery(accountTag: string, since: Date, until: Date) {
  return {
    query: `query WorkersMonth($accountTag: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 1000, filter: { datetime_geq: $since, datetime_leq: $until }, orderBy: [sum_cpuTimeUs_DESC]) {
        sum { requests cpuTimeUs }
        dimensions { scriptName }
      }
    }
  }
}`,
    variables: { accountTag, since: since.toISOString(), until: until.toISOString() },
  }
}

/** Today's query: Workers AI neurons per model since 00:00 UTC. */
export function aiQuery(accountTag: string, since: Date, until: Date) {
  return {
    query: `query AiToday($accountTag: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      aiInferenceAdaptiveGroups(limit: 100, filter: { datetime_geq: $since, datetime_leq: $until }, orderBy: [sum_totalNeurons_DESC]) {
        sum { totalNeurons }
        dimensions { modelId }
      }
    }
  }
}`,
    variables: { accountTag, since: since.toISOString(), until: until.toISOString() },
  }
}

export type WorkerRow = { worker: string; requests: number; cpuMs: number }

/** What a GraphQL query answered, as fetched (cached as is). */
export type WorkersRaw = { at: string; rows: WorkerRow[] }
export type AiRaw = { at: string; models: { model: string; neurons: number }[] }

type WorkersAnswer = { viewer?: { accounts?: { workersInvocationsAdaptive?: { sum?: { requests?: number; cpuTimeUs?: number }; dimensions?: { scriptName?: string } }[] }[] } }
type AiAnswer = { viewer?: { accounts?: { aiInferenceAdaptiveGroups?: { sum?: { totalNeurons?: number }; dimensions?: { modelId?: string } }[] }[] } }

/** One row per Worker, CPU time in ms, busiest (by CPU, then requests) first. */
export function parseWorkers(data: WorkersAnswer): WorkerRow[] {
  const groups = data.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? []
  const byWorker = new Map<string, WorkerRow>()
  for (const group of groups) {
    const worker = group.dimensions?.scriptName || 'Unnamed Worker'
    const row = byWorker.get(worker) ?? { worker, requests: 0, cpuMs: 0 }
    row.requests += group.sum?.requests ?? 0
    row.cpuMs += usToMs(group.sum?.cpuTimeUs ?? 0)
    byWorker.set(worker, row)
  }
  return [...byWorker.values()].sort((a, b) => b.cpuMs - a.cpuMs || b.requests - a.requests)
}

export function parseAi(data: AiAnswer): { model: string; neurons: number }[] {
  const groups = data.viewer?.accounts?.[0]?.aiInferenceAdaptiveGroups ?? []
  return groups
    .map((group) => ({ model: group.dimensions?.modelId || 'Unknown model', neurons: group.sum?.totalNeurons ?? 0 }))
    .filter((row) => row.neurons > 0)
    .sort((a, b) => b.neurons - a.neurons)
}

export type Allowance = {
  used: number
  included: number
  /** Straight-line to the end of the month. */
  projected: number
  /** False in the month's first day: the projection shows but doesn't alert. */
  projectionReady: boolean
  level: Level
  share: number
  basis: 'used' | 'projected'
}

export type WorkersUsage = {
  at: string
  monthStart: string
  monthEnd: string
  requests: Allowance
  cpuMs: Allowance
  workers: WorkerRow[]
}

export type AiUsage = {
  at: string
  day: string
  neurons: number
  free: number
  slice: number
  level: Level
  share: number
  models: { model: string; neurons: number }[]
}

function allowance(used: number, included: number, at: Date): Allowance {
  const projected = projectToMonthEnd(used, at)
  const ready = projectionReady(at)
  return { used, included, projected, projectionReady: ready, ...allowanceLevel(used, ready ? projected : null, included) }
}

/** The month so far, measured at the moment the numbers were fetched. */
export function toWorkersUsage(raw: WorkersRaw): WorkersUsage {
  const at = new Date(raw.at)
  const { start, end } = monthWindow(at)
  const requests = raw.rows.reduce((sum, row) => sum + row.requests, 0)
  const cpuMs = raw.rows.reduce((sum, row) => sum + row.cpuMs, 0)
  return {
    at: raw.at,
    monthStart: start.toISOString(),
    monthEnd: end.toISOString(),
    requests: allowance(requests, WORKERS_INCLUDED.requests, at),
    cpuMs: allowance(cpuMs, WORKERS_INCLUDED.cpuMs, at),
    workers: raw.rows,
  }
}

export function toAiUsage(raw: AiRaw): AiUsage {
  const neurons = raw.models.reduce((sum, row) => sum + row.neurons, 0)
  const { level, share } = allowanceLevel(neurons, null, AI_FREE_NEURONS_PER_DAY)
  return {
    at: raw.at,
    day: dayStart(new Date(raw.at)).toISOString().slice(0, 10),
    neurons,
    free: AI_FREE_NEURONS_PER_DAY,
    slice: PORTFOLIORANK_AI_SLICE,
    level,
    share,
    models: raw.models,
  }
}

/** The Overview tile: the allowance closest to its limit, and the chip text when it needs attention. */
export function usageTile(workers: WorkersUsage, ai: AiUsage | null): { headline: string; detail: string; status: string; tone: 'bad' | 'warn' | 'quiet'; meter: { value: number; max: number } } {
  const month = new Date(workers.at).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const candidates = [
    { name: 'CPU', label: 'Workers CPU time', share: workers.cpuMs.share, level: workers.cpuMs.level, basis: workers.cpuMs.basis, max: workers.cpuMs.included },
    { name: 'Requests', label: 'Workers requests', share: workers.requests.share, level: workers.requests.level, basis: workers.requests.basis, max: workers.requests.included },
    ...(ai ? [{ name: 'Workers AI', label: 'Workers AI neurons', share: ai.share, level: ai.level, basis: 'today' as const, max: ai.free }] : []),
  ].sort((a, b) => b.share - a.share)
  const top = candidates[0]
  // The meter draws the same share as the headline (projected, when the projection is the larger).
  const meter = { value: top.share * top.max, max: top.max }
  const percent = formatPercent(top.share)
  const when = top.basis === 'projected' ? `projected for ${month}` : top.basis === 'today' ? 'of today\'s free' : `used in ${month}`
  const detail = `${top.label}, ${when}`
  if (top.level === 'good') return { headline: percent, detail, status: 'Fine', tone: 'quiet', meter }
  return { headline: percent, detail, status: `${top.name} ${percent} ${top.basis === 'projected' ? 'projected' : 'used'}`, tone: top.level, meter }
}

/** "4.2M" style for big counts on small tiles. */
export function compact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (value >= 10_000) return `${Math.round(value / 1000)}K`
  return formatNumber(value)
}

// ---------------------------------------------------------------------------
// Reading the API

/**
 * Made-up numbers for screenshots and the E2E run (tests/e2e/cloudflare.spec.ts),
 * only in a local E2E build (ADMIN_E2E_BUILD is inlined as "" in every other
 * build, so this compiles to `return false`; scripts/check-no-dev-bypass.mjs
 * fails a normal build if CF_ANALYTICS_FIXTURE survives) and never on a host.
 */
export function cloudflareFixtureEnabled(): boolean {
  if (process.env.ADMIN_E2E_BUILD !== '1') return false
  if (process.env.VERCEL || process.env.APP_ENV) return false
  return process.env.CF_ANALYTICS_FIXTURE === '1'
}

export function isCloudflareUsageConnected(): boolean {
  return Boolean(process.env.CF_ANALYTICS_TOKEN?.trim()) || cloudflareFixtureEnabled()
}

export class CloudflareApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly permission: boolean,
  ) {
    super(message)
  }
}

/** POSTs one query; throws CloudflareApiError on an HTTP error or any GraphQL error. */
export async function graphql<T>(token: string, request: { query: string; variables: Record<string, unknown> }): Promise<T> {
  const name = /query (\w+)/.exec(request.query)?.[1] ?? 'query'
  let response: Response
  try {
    response = await traced(`cloudflare graphql ${name}`, () =>
      fetch(GRAPHQL_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(10_000),
      }),
    )
  } catch (error) {
    throw new CloudflareApiError(error instanceof Error ? `Cloudflare didn't answer: ${error.message}` : 'Cloudflare didn\'t answer', 0, false)
  }
  const body = (await response.json().catch(() => null)) as { data?: T | null; errors?: { message?: string }[] | null } | null
  const errors = body?.errors ?? []
  if (!response.ok || errors.length > 0 || !body?.data) {
    const message = errors[0]?.message || `Cloudflare answered ${response.status} ${response.statusText}`.trim()
    const permission = response.status === 401 || response.status === 403 || /not authori[sz]ed|authenticat|permission|access denied|forbidden/i.test(message)
    throw new CloudflareApiError(message, response.status, permission)
  }
  return body.data
}

function token(): string {
  const value = process.env.CF_ANALYTICS_TOKEN?.trim()
  if (!value) throw new CloudflareApiError('No Cloudflare analytics token', 0, true)
  return value
}

async function loadWorkers(since: string, fixture: boolean): Promise<WorkersRaw> {
  const now = new Date()
  if (fixture) return fixtureWorkers(now)
  const data = await graphql<WorkersAnswer>(token(), workersQuery(CLOUDFLARE_ACCOUNT, new Date(since), now))
  return { at: now.toISOString(), rows: parseWorkers(data) }
}

async function loadAi(since: string, fixture: boolean): Promise<AiRaw> {
  const now = new Date()
  if (fixture) return fixtureAi(now)
  const data = await graphql<AiAnswer>(token(), aiQuery(CLOUDFLARE_ACCOUNT, new Date(since), now))
  return { at: now.toISOString(), models: parseAi(data) }
}

// Cached per month (or day) and mode: the arguments are part of the key, and a thrown error is never cached.
const cachedWorkers = unstable_cache(loadWorkers, ['cloudflare-usage', 'workers'], { revalidate: CACHE_SECONDS })
const cachedAi = unstable_cache(loadAi, ['cloudflare-usage', 'ai'], { revalidate: CACHE_SECONDS })

function failed(error: unknown): { ok: false; status: number; message: string; permission: boolean } {
  if (error instanceof CloudflareApiError) return { ok: false, status: error.status, message: error.message, permission: error.permission }
  return { ok: false, status: 0, message: error instanceof Error ? error.message : 'Unknown error', permission: false }
}

/** Workers requests and CPU time this month, per Worker. */
export const getWorkersUsage = cache(async (): Promise<Read<WorkersUsage>> => {
  try {
    const raw = await cachedWorkers(monthWindow(new Date()).start.toISOString(), cloudflareFixtureEnabled())
    return { ok: true, data: toWorkersUsage(raw) }
  } catch (error) {
    return failed(error)
  }
})

/** Workers AI neurons today, per model. */
export const getAiUsage = cache(async (): Promise<Read<AiUsage>> => {
  try {
    const raw = await cachedAi(dayStart(new Date()).toISOString(), cloudflareFixtureEnabled())
    return { ok: true, data: toAiUsage(raw) }
  } catch (error) {
    return failed(error)
  }
})
