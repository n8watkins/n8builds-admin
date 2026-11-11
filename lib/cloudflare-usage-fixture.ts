import type { AiRaw, WorkersRaw } from './cloudflare-usage'

/*
 * Made-up Cloudflare usage for screenshots and the E2E run, never real
 * figures. The month's totals grow with the month, so the projection to its
 * end stays the same whatever the date: requests land at 46% of the included
 * 10 million and CPU time at 78% of the 30 million ms, so the page shows one
 * fine allowance and one that needs attention.
 */

const PROJECTED = { requests: 4_600_000, cpuMs: 23_400_000 }

/** Each Worker's share of the month's requests and CPU time. */
const WORKERS: [worker: string, requests: number, cpu: number][] = [
  ['n8builds-web', 0.46, 0.41],
  ['portfolio-rank', 0.21, 0.33],
  ['n8builds-admin', 0.09, 0.1],
  ['mailroom', 0.12, 0.08],
  ['open-ping', 0.07, 0.05],
  ['net-trailers', 0.05, 0.03],
]

function elapsed(now: Date): number {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  return Math.max(3_600_000, now.getTime() - start) / (end - start)
}

export function fixtureWorkers(now: Date): WorkersRaw {
  const share = elapsed(now)
  return {
    at: now.toISOString(),
    rows: WORKERS.map(([worker, requests, cpu]) => ({
      worker,
      requests: Math.round(PROJECTED.requests * share * requests),
      cpuMs: Math.round(PROJECTED.cpuMs * share * cpu),
    })),
  }
}

export function fixtureAi(now: Date): AiRaw {
  return {
    at: now.toISOString(),
    models: [
      { model: '@cf/black-forest-labs/flux-1-schnell', neurons: 1_740 },
      { model: '@cf/meta/llama-3.1-8b-instruct-fp8', neurons: 960 },
      { model: '@cf/baai/bge-base-en-v1.5', neurons: 440 },
    ],
  }
}
