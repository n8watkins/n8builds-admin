import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { isDevBypassEnabled } from '@/lib/auth/dev-bypass'

function env(vars: Record<string, string | undefined>) {
  vi.stubEnv('VERCEL', undefined)
  for (const [name, value] of Object.entries(vars)) vi.stubEnv(name, value)
}

describe('isDevBypassEnabled', () => {
  it('is on only under next dev with ADMIN_DEV_BYPASS=1', () => {
    env({ NODE_ENV: 'development', ADMIN_DEV_BYPASS: '1' })
    expect(isDevBypassEnabled()).toBe(true)
  })

  it('is off in production, whatever ADMIN_DEV_BYPASS says', () => {
    env({ NODE_ENV: 'production', ADMIN_DEV_BYPASS: '1' })
    expect(isDevBypassEnabled()).toBe(false)
  })

  it('is off under test and any other NODE_ENV', () => {
    for (const mode of ['test', 'Development', '', undefined]) {
      env({ NODE_ENV: mode, ADMIN_DEV_BYPASS: '1' })
      expect(isDevBypassEnabled()).toBe(false)
    }
  })

  it('is off on Vercel even in development mode', () => {
    env({ NODE_ENV: 'development', ADMIN_DEV_BYPASS: '1', VERCEL: '1' })
    expect(isDevBypassEnabled()).toBe(false)
  })

  it('needs exactly "1"', () => {
    for (const value of ['true', 'yes', '0', ' 1', '', undefined]) {
      env({ NODE_ENV: 'development', ADMIN_DEV_BYPASS: value })
      expect(isDevBypassEnabled()).toBe(false)
    }
  })

  it('reads NODE_ENV as a literal process.env.NODE_ENV, so production builds compile the bypass away', () => {
    // Next.js inlines `process.env.NODE_ENV` at build time. If this check ever
    // became indirect (process.env[name], a destructured env, a helper), the
    // bundler could no longer replace it and a runtime variable might matter.
    const source = readFileSync(fileURLToPath(new URL('../../lib/auth/dev-bypass.ts', import.meta.url)), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).toMatch(/if \(process\.env\.NODE_ENV !== 'development'\) return false/)
    // ...and it is the first statement, so nothing runs before it.
    expect(code.indexOf("process.env.NODE_ENV !== 'development'")).toBeLessThan(code.indexOf('ADMIN_DEV_BYPASS'))
    expect(code).not.toMatch(/process\.env\[/)
  })

  it('stays off when the function is compiled with NODE_ENV inlined as "production"', async () => {
    // What `next build` does: replace process.env.NODE_ENV with a literal.
    const source = readFileSync(fileURLToPath(new URL('../../lib/auth/dev-bypass.ts', import.meta.url)), 'utf8')
    const { transform } = await import('esbuild')
    const { code } = await transform(source, { loader: 'ts', format: 'cjs', define: { 'process.env.NODE_ENV': '"production"' }, minifySyntax: true })
    expect(code).not.toContain('ADMIN_DEV_BYPASS')
    env({ NODE_ENV: 'development', ADMIN_DEV_BYPASS: '1' })
    const compiled = { exports: {} as { isDevBypassEnabled?: () => boolean } }
    new Function('module', 'exports', 'process', code)(compiled, compiled.exports, process)
    expect(compiled.exports.isDevBypassEnabled?.()).toBe(false)
  })
})
