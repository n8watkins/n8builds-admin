import 'server-only'
import { cache } from 'react'
import { REVALIDATE_SECONDS } from './cache'
import type { Fetched } from './github'
import { CLOUDFLARE_ACCOUNT } from './repos'
import { traced } from './trace'

/**
 * Cloudflare Workers deploys, the Releases page's replacement for the Vercel
 * deployments GitHub used to record. Read with a read-only API token
 * (Account, Workers Scripts, Read) in CLOUDFLARE_DEPLOYS_TOKEN; docs/SETUP.md.
 */
export function isCloudflareConnected(): boolean {
  return Boolean(process.env.CLOUDFLARE_DEPLOYS_TOKEN)
}

export type WorkerDeploy = {
  worker: string
  createdAt: string
  /** What made it: `wrangler`, `dash`, `api`, or Workers Builds. */
  source: string
  /** Why: a code deploy, a secret change, a rollback. */
  trigger: string | null
  /** The `--message` given to `wrangler deploy`, if any. */
  message: string | null
  /** The version serving all (or most) traffic, shortened. */
  version: string | null
  /** The Worker's page in the Cloudflare dashboard. */
  url: string
}

type RawDeployment = {
  id: string
  source: string
  created_on: string
  annotations?: Record<string, string>
  versions: { version_id: string; percentage: number }[]
}

export function workerDashboardUrl(worker: string): string {
  return `https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT}/workers/services/view/${worker}/production`
}

/** Turns the API's newest deployment into what the page shows (exported for tests). */
export function toWorkerDeploy(worker: string, raw: RawDeployment | undefined): WorkerDeploy | null {
  if (!raw) return null
  const main = [...raw.versions].sort((a, b) => b.percentage - a.percentage)[0]
  return {
    worker,
    createdAt: raw.created_on,
    source: raw.source,
    trigger: raw.annotations?.['workers/triggered_by'] ?? null,
    message: raw.annotations?.['workers/message'] ?? null,
    version: main ? main.version_id.slice(0, 8) : null,
    url: workerDashboardUrl(worker),
  }
}

/** The Worker's newest deployment (what is live now), or null if it was never deployed. */
export const getWorkerDeploy = cache(async (worker: string): Promise<Fetched<WorkerDeploy | null>> => {
  const token = process.env.CLOUDFLARE_DEPLOYS_TOKEN
  if (!token) return { ok: false, status: 0, message: 'No Cloudflare token' }
  const path = `/accounts/${CLOUDFLARE_ACCOUNT}/workers/scripts/${encodeURIComponent(worker)}/deployments`
  try {
    const response = await traced(`cloudflare ${path}`, () =>
      fetch(`https://api.cloudflare.com/client/v4${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: REVALIDATE_SECONDS },
      }),
    )
    const body = (await response.json().catch(() => ({}))) as {
      success?: boolean
      errors?: { message: string }[]
      result?: { deployments?: RawDeployment[] }
    }
    // A Worker that doesn't exist (yet) has no deploys rather than an error.
    if (response.status === 404) return { ok: true, data: null }
    if (!response.ok || !body.success) {
      return { ok: false, status: response.status, message: body.errors?.[0]?.message ?? response.statusText }
    }
    const newest = [...(body.result?.deployments ?? [])].sort((a, b) => b.created_on.localeCompare(a.created_on))[0]
    return { ok: true, data: toWorkerDeploy(worker, newest) }
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : 'Network error' }
  }
})
