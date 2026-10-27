import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { isTestAuthEnabled } from '@/lib/auth/test-auth'

const source = readFileSync(fileURLToPath(new URL('../../lib/auth/test-auth.ts', import.meta.url)), 'utf8')

function env(vars: Record<string, string | undefined>) {
  vi.stubEnv('VERCEL', undefined)
  vi.stubEnv('ADMIN_E2E_BUILD', undefined)
  vi.stubEnv('ADMIN_TEST_AUTH', undefined)
  for (const [name, value] of Object.entries(vars)) vi.stubEnv(name, value)
}

/** Compiles the module the way `next build` does: ADMIN_E2E_BUILD replaced by a literal. */
async function compiled(e2eBuild: string) {
  const { transform } = await import('esbuild')
  const { code } = await transform(source, { loader: 'ts', format: 'cjs', define: { 'process.env.ADMIN_E2E_BUILD': JSON.stringify(e2eBuild) }, minifySyntax: true })
  const output = { exports: {} as { isTestAuthEnabled?: () => boolean } }
  new Function('module', 'exports', 'process', code)(output, output.exports, process)
  return { code, isEnabled: output.exports.isTestAuthEnabled! }
}

describe('isTestAuthEnabled', () => {
  it('is on only in an E2E build with ADMIN_TEST_AUTH=1, off Vercel', () => {
    env({ ADMIN_E2E_BUILD: '1', ADMIN_TEST_AUTH: '1' })
    expect(isTestAuthEnabled()).toBe(true)
  })

  it('is off without the E2E build flag, whatever ADMIN_TEST_AUTH says', () => {
    env({ ADMIN_TEST_AUTH: '1' })
    expect(isTestAuthEnabled()).toBe(false)
  })

  it('is off on Vercel, even in an E2E build', () => {
    env({ ADMIN_E2E_BUILD: '1', ADMIN_TEST_AUTH: '1', VERCEL: '1' })
    expect(isTestAuthEnabled()).toBe(false)
  })

  it('needs exactly "1"', () => {
    for (const value of ['true', 'yes', '0', '', undefined]) {
      env({ ADMIN_E2E_BUILD: '1', ADMIN_TEST_AUTH: value })
      expect(isTestAuthEnabled()).toBe(false)
    }
  })

  it('compiles away in a normal build: no runtime variable can turn it on', async () => {
    const { code, isEnabled } = await compiled('')
    expect(code).not.toContain('ADMIN_TEST_AUTH')
    env({ ADMIN_E2E_BUILD: '1', ADMIN_TEST_AUTH: '1' })
    expect(isEnabled()).toBe(false)
  })

  it('reads the build flag as a literal process.env.ADMIN_E2E_BUILD the bundler can inline', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).toMatch(/if \(process\.env\.ADMIN_E2E_BUILD !== '1'\) return false/)
    expect(code.indexOf('ADMIN_E2E_BUILD')).toBeLessThan(code.indexOf('ADMIN_TEST_AUTH'))
    expect(code).not.toMatch(/process\.env\[/)
  })

  it('is inlined by next.config.mjs as "" unless ADMIN_E2E_BUILD=1, and refused on Vercel', async () => {
    const config = readFileSync(fileURLToPath(new URL('../../next.config.mjs', import.meta.url)), 'utf8')
    expect(config).toMatch(/env: \{ ADMIN_E2E_BUILD: e2eBuild \? '1' : '' \}/)
    expect(config).toMatch(/distDir: e2eBuild \? '\.next-e2e' : '\.next'/)
    expect(config).toMatch(/if \(e2eBuild && process\.env\.VERCEL\) \{\s*throw/)
  })
})
