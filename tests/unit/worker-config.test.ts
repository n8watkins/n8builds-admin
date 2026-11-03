import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// The Cloudflare Worker must never run the dev sign-in bypass or the test
// sign-in. Three independent locks keep them off; each is pinned here:
// 1. the Worker bundle is a normal production build (both compiled out),
//    checked again on the bundle itself after every Worker build;
// 2. next.config.mjs refuses an E2E build whenever OpenNext builds;
// 3. wrangler.jsonc sets APP_ENV, which switches both off at runtime.

const root = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, root)), 'utf8')

function wrangler() {
  const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', read('wrangler.jsonc'))
  if (parsed.error) throw new Error(String(parsed.error.messageText))
  return parsed.config as { vars?: Record<string, string>; triggers?: { crons?: string[] } }
}

describe('the Cloudflare Worker (wrangler.jsonc)', () => {
  it('runs with APP_ENV=production', () => {
    expect(wrangler().vars?.APP_ENV).toBe('production')
  })

  it('never sets a sign-in bypass variable', () => {
    for (const name of ['ADMIN_DEV_BYPASS', 'ADMIN_TEST_AUTH', 'ADMIN_E2E_BUILD']) {
      expect(Object.keys(wrangler().vars ?? {})).not.toContain(name)
    }
  })

  it('runs the daily snapshot at the time the Vercel cron did', () => {
    const vercel = JSON.parse(read('vercel.json')) as { crons: { path: string; schedule: string }[] }
    const snapshot = vercel.crons.find((cron) => cron.path === '/api/cron/snapshot')
    expect(wrangler().triggers?.crons).toEqual([snapshot?.schedule])
  })
})

describe('the Worker build', () => {
  const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts

  it('checks the bundle it deploys for both bypasses', () => {
    expect(scripts['build:worker']).toMatch(/^opennextjs-cloudflare build && node scripts\/check-no-dev-bypass\.mjs --worker$/)
    expect(scripts.deploy).toMatch(/^npm run build:worker && /)
    expect(read('scripts/check-no-dev-bypass.mjs')).toMatch(/const dist = worker \? '\.open-next'/)
  })

  it('makes OpenNext run next build with ADMIN_WORKER_BUILD=1', () => {
    expect(read('open-next.config.ts')).toMatch(/buildCommand: 'ADMIN_WORKER_BUILD=1 npm run build'/)
  })

  it('cannot be an E2E build: next.config.mjs throws', () => {
    for (const flag of ['ADMIN_WORKER_BUILD', 'WORKERS_CI']) {
      const run = () =>
        execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./next.config.mjs')"], {
          cwd: fileURLToPath(root),
          env: { PATH: process.env.PATH, NODE_ENV: 'production', ADMIN_E2E_BUILD: '1', [flag]: '1' },
          stdio: 'pipe',
        })
      expect(run, flag).toThrow(/never set it for a Vercel or Cloudflare build/)
    }
  })

  it('flags a bundle that still reads a bypass', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = mkdtempSync(join(tmpdir(), 'admin-worker-'))
    try {
      mkdirSync(join(dir, '.open-next', 'server-functions'), { recursive: true })
      const script = fileURLToPath(new URL('scripts/check-no-dev-bypass.mjs', root))
      const check = () => execFileSync(process.execPath, [script, '--worker'], { cwd: dir, stdio: 'pipe' })
      writeFileSync(join(dir, '.open-next', 'server-functions', 'index.mjs'), 'export const ok = 1')
      expect(check).not.toThrow()
      writeFileSync(join(dir, '.open-next', 'server-functions', 'index.mjs'), 'export const on = () => process.env.ADMIN_TEST_AUTH === "1"')
      expect(check).toThrow()
      rmSync(join(dir, '.open-next'), { recursive: true })
      // No bundle at all fails too: nothing was checked.
      expect(check).toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
