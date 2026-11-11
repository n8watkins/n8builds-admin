import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
// No Next.js data cache in tests: every call goes to the (mocked) fetch.
vi.mock('next/cache', () => ({ unstable_cache: <T>(load: T) => load }))
const usage = await import('@/lib/cloudflare-usage')
const {
  AI_FREE_NEURONS_PER_DAY,
  GRAPHQL_URL,
  WORKERS_INCLUDED,
  aiQuery,
  allowanceLevel,
  compact,
  dayStart,
  getAiUsage,
  getWorkersUsage,
  graphql,
  isCloudflareUsageConnected,
  monthWindow,
  parseAi,
  parseWorkers,
  projectToMonthEnd,
  projectionReady,
  toAiUsage,
  toWorkersUsage,
  usageTile,
  usToMs,
  workersQuery,
} = usage

const ACCOUNT = 'b2c564cf83cb9184dd6d7cc4ff8b38bf'

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('query building', () => {
  it('asks for requests and CPU time per Worker since the start of the UTC month', () => {
    const since = new Date('2026-11-01T00:00:00Z')
    const until = new Date('2026-11-11T12:00:00Z')
    const { query, variables } = workersQuery(ACCOUNT, since, until)
    expect(query).toContain('accounts(filter: { accountTag: $accountTag })')
    expect(query).toContain('workersInvocationsAdaptive(')
    expect(query).toContain('filter: { datetime_geq: $since, datetime_leq: $until }')
    expect(query).toContain('sum { requests cpuTimeUs }')
    expect(query).toContain('dimensions { scriptName }')
    expect(query).toContain('orderBy: [sum_cpuTimeUs_DESC]')
    expect(variables).toEqual({ accountTag: ACCOUNT, since: '2026-11-01T00:00:00.000Z', until: '2026-11-11T12:00:00.000Z' })
  })

  it('asks for Workers AI neurons per model since 00:00 UTC', () => {
    const { query, variables } = aiQuery(ACCOUNT, new Date('2026-11-11T00:00:00Z'), new Date('2026-11-11T09:30:00Z'))
    expect(query).toContain('aiInferenceAdaptiveGroups(')
    expect(query).toContain('sum { totalNeurons }')
    expect(query).toContain('dimensions { modelId }')
    expect(variables.since).toBe('2026-11-11T00:00:00.000Z')
  })

  it('finds the UTC month and day, whatever the local time zone', () => {
    const { start, end } = monthWindow(new Date('2026-12-31T23:59:59Z'))
    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z')
    expect(dayStart(new Date('2026-11-11T23:10:00Z')).toISOString()).toBe('2026-11-11T00:00:00.000Z')
  })
})

describe('unit conversion and parsing', () => {
  it('turns microseconds into milliseconds', () => {
    expect(usToMs(1_500_000)).toBe(1500)
    expect(usToMs(0)).toBe(0)
  })

  it('adds up each Worker, CPU in ms, busiest CPU first', () => {
    const rows = parseWorkers({
      viewer: {
        accounts: [
          {
            workersInvocationsAdaptive: [
              { sum: { requests: 900, cpuTimeUs: 2_000_000 }, dimensions: { scriptName: 'site' } },
              { sum: { requests: 100, cpuTimeUs: 9_000_000 }, dimensions: { scriptName: 'api' } },
              // A second group for the same Worker is added to it.
              { sum: { requests: 50, cpuTimeUs: 500_000 }, dimensions: { scriptName: 'site' } },
              { sum: { requests: 5, cpuTimeUs: 1000 }, dimensions: { scriptName: '' } },
            ],
          },
        ],
      },
    })
    expect(rows).toEqual([
      { worker: 'api', requests: 100, cpuMs: 9000 },
      { worker: 'site', requests: 950, cpuMs: 2500 },
      { worker: 'Unnamed Worker', requests: 5, cpuMs: 1 },
    ])
    expect(parseWorkers({})).toEqual([])
  })

  it('lists models by neurons and drops the empty ones', () => {
    expect(
      parseAi({
        viewer: {
          accounts: [
            {
              aiInferenceAdaptiveGroups: [
                { sum: { totalNeurons: 12.5 }, dimensions: { modelId: '@cf/a' } },
                { sum: { totalNeurons: 0 }, dimensions: { modelId: '@cf/b' } },
                { sum: { totalNeurons: 300 }, dimensions: { modelId: '@cf/c' } },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      { model: '@cf/c', neurons: 300 },
      { model: '@cf/a', neurons: 12.5 },
    ])
  })

  it('shortens big counts', () => {
    expect(compact(950)).toBe('950')
    expect(compact(45_400)).toBe('45K')
    expect(compact(4_600_000)).toBe('4.6M')
    expect(compact(3_000_000)).toBe('3M')
    expect(compact(30_000_000)).toBe('30M')
  })
})

describe('projection', () => {
  it('draws a straight line to the end of the month', () => {
    // November has 30 days; on the 11th at 00:00, 10 days have gone.
    expect(projectToMonthEnd(1_000_000, new Date('2026-11-11T00:00:00Z'))).toBeCloseTo(3_000_000)
    // At the very end it is what was used.
    expect(projectToMonthEnd(500, new Date('2026-11-30T23:59:59.999Z'))).toBeCloseTo(500, 0)
  })

  it('takes the first hour as a whole hour, so a few early requests don\'t explode', () => {
    expect(projectToMonthEnd(10, new Date('2026-11-01T00:00:01Z'))).toBeCloseTo(10 * 24 * 30)
  })

  it('counts towards alerts only after the first day', () => {
    expect(projectionReady(new Date('2026-11-01T23:59:00Z'))).toBe(false)
    expect(projectionReady(new Date('2026-11-02T00:00:00Z'))).toBe(true)
  })
})

describe('thresholds', () => {
  it('needs attention at 70%, is red at 90%, of what is used or projected', () => {
    expect(allowanceLevel(6_900_000, null, 10_000_000)).toMatchObject({ level: 'good', basis: 'used' })
    expect(allowanceLevel(7_000_000, null, 10_000_000)).toMatchObject({ level: 'warn', basis: 'used' })
    expect(allowanceLevel(9_000_000, null, 10_000_000)).toMatchObject({ level: 'bad', basis: 'used' })
    expect(allowanceLevel(2_000_000, 7_500_000, 10_000_000)).toMatchObject({ level: 'warn', basis: 'projected', share: 0.75 })
    expect(allowanceLevel(2_000_000, 9_500_000, 10_000_000)).toMatchObject({ level: 'bad', basis: 'projected' })
    expect(allowanceLevel(0, 0, 0)).toMatchObject({ level: 'good', share: 0 })
  })

  it('ignores the projection in the month\'s first day', () => {
    const raw = { at: '2026-11-01T06:00:00Z', rows: [{ worker: 'a', requests: 1_000_000, cpuMs: 10 }] }
    const result = toWorkersUsage(raw)
    // 1M in 6 hours projects to 120M, but it doesn't count yet.
    expect(result.requests.projected).toBeCloseTo(120_000_000)
    expect(result.requests.projectionReady).toBe(false)
    expect(result.requests.level).toBe('good')
  })

  it('totals the month and flags the allowance that projects past 70%', () => {
    const result = toWorkersUsage({
      at: '2026-11-11T00:00:00Z',
      rows: [
        { worker: 'site', requests: 1_000_000, cpuMs: 6_000_000 },
        { worker: 'api', requests: 500_000, cpuMs: 1_000_000 },
      ],
    })
    expect(result.monthStart).toBe('2026-11-01T00:00:00.000Z')
    expect(result.requests).toMatchObject({ used: 1_500_000, included: WORKERS_INCLUDED.requests, level: 'good' })
    expect(result.requests.projected).toBeCloseTo(4_500_000)
    expect(result.cpuMs).toMatchObject({ used: 7_000_000, included: WORKERS_INCLUDED.cpuMs, level: 'warn', basis: 'projected' })
    expect(result.cpuMs.projected).toBeCloseTo(21_000_000)
  })

  it('makes the Overview tile from the allowance closest to its limit', () => {
    const workers = toWorkersUsage({ at: '2026-11-11T00:00:00Z', rows: [{ worker: 'a', requests: 1_000_000, cpuMs: 9_500_000 }] })
    // CPU projects to 28.5M of 30M: 95%.
    expect(usageTile(workers, null)).toMatchObject({ headline: '95%', status: 'CPU 95% projected', tone: 'bad', meter: { max: 30_000_000 } })
    expect(usageTile(workers, null).meter.value).toBeCloseTo(28_500_000)
    const calm = toWorkersUsage({ at: '2026-11-11T00:00:00Z', rows: [{ worker: 'a', requests: 100_000, cpuMs: 100_000 }] })
    expect(usageTile(calm, null)).toMatchObject({ status: 'Fine', tone: 'quiet' })
    const ai = toAiUsage({ at: '2026-11-11T10:00:00Z', models: [{ model: '@cf/x', neurons: 7_200 }] })
    expect(ai).toMatchObject({ day: '2026-11-11', neurons: 7_200, free: AI_FREE_NEURONS_PER_DAY, level: 'warn' })
    expect(usageTile(calm, ai)).toMatchObject({ headline: '72%', status: 'Workers AI 72% used', tone: 'warn' })
  })
})

describe('reading the GraphQL API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is not connected without a token', async () => {
    vi.stubEnv('CF_ANALYTICS_TOKEN', '')
    vi.stubEnv('ADMIN_E2E_BUILD', '')
    expect(isCloudflareUsageConnected()).toBe(false)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(await getWorkersUsage()).toMatchObject({ ok: false, permission: true })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never uses the made-up numbers outside a local E2E build', () => {
    vi.stubEnv('CF_ANALYTICS_TOKEN', '')
    vi.stubEnv('CF_ANALYTICS_FIXTURE', '1')
    vi.stubEnv('ADMIN_E2E_BUILD', '')
    expect(isCloudflareUsageConnected()).toBe(false)
    vi.stubEnv('ADMIN_E2E_BUILD', '1')
    vi.stubEnv('APP_ENV', 'production')
    expect(isCloudflareUsageConnected()).toBe(false)
  })

  it('posts the query with the token and reads the answer', async () => {
    vi.stubEnv('CF_ANALYTICS_TOKEN', 'token')
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      answer({ data: { viewer: { accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 42, cpuTimeUs: 3_000 }, dimensions: { scriptName: 'site' } }] }] } }, errors: null }),
    )
    vi.stubGlobal('fetch', fetch)
    const result = await getWorkersUsage()
    expect(result).toMatchObject({ ok: true, data: { requests: { used: 42 }, cpuMs: { used: 3 }, workers: [{ worker: 'site', requests: 42, cpuMs: 3 }] } })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe(GRAPHQL_URL)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token')
    const body = JSON.parse(String(init.body))
    expect(body.variables.accountTag).toBe(ACCOUNT)
    expect(body.variables.since).toMatch(/^\d{4}-\d{2}-01T00:00:00\.000Z$/)
  })

  it('reports a permission error apart from an outage', async () => {
    vi.stubEnv('CF_ANALYTICS_TOKEN', 'token')
    vi.stubGlobal('fetch', vi.fn(async () => answer({ data: null, errors: [{ message: 'not authorized for that account' }] })))
    expect(await getAiUsage()).toEqual({ ok: false, status: 200, message: 'not authorized for that account', permission: true })

    vi.stubGlobal('fetch', vi.fn(async () => answer({}, 403)))
    expect(await getAiUsage()).toMatchObject({ ok: false, status: 403, permission: true })

    vi.stubGlobal('fetch', vi.fn(async () => new Response('Bad gateway', { status: 502, statusText: 'Bad Gateway' })))
    expect(await getWorkersUsage()).toEqual({ ok: false, status: 502, message: 'Cloudflare answered 502 Bad Gateway', permission: false })

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('socket hang up'))))
    expect(await getWorkersUsage()).toEqual({ ok: false, status: 0, message: 'Cloudflare didn\'t answer: socket hang up', permission: false })
  })

  it('treats any GraphQL error as a failure, even with partial data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => answer({ data: { viewer: { accounts: [] } }, errors: [{ message: 'query exceeds the time range' }] })))
    await expect(graphql('token', aiQuery(ACCOUNT, new Date(), new Date()))).rejects.toMatchObject({ message: 'query exceeds the time range', permission: false })
  })
})
