// Runs after every build (npm's postbuild and postbuild:e2e). It fails the
// build if a compiled server or client file still reads a sign-in bypass:
// - the dev preview's ADMIN_DEV_BYPASS, in every production build;
// - the test stub's ADMIN_TEST_AUTH, in every build except a local E2E build
//   (ADMIN_E2E_BUILD=1, written to .next-e2e);
// - the Cloudflare usage page's made-up numbers, CF_ANALYTICS_FIXTURE
//   (lib/cloudflare-usage.ts), on the same terms as ADMIN_TEST_AUTH.
// With --worker it checks the Cloudflare Worker bundle instead (.open-next,
// what `opennextjs-cloudflare deploy` uploads), for both reads: no E2E build
// is ever allowed there (npm run build:worker and npm run deploy run it).
// Both checks in lib/auth compile to `return false` in a normal production
// build, so the reads must be gone; if one is ever there, the bypass could
// reach production.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const worker = process.argv.includes('--worker')
const e2e = !worker && process.env.ADMIN_E2E_BUILD === '1'
const dist = worker ? '.open-next' : e2e ? '.next-e2e' : '.next'
const reads = (name) => new RegExp(`env\\s*(?:\\.\\s*${name}|\\[\\s*["'\`]${name})`)
const forbidden = [
  ['ADMIN_DEV_BYPASS', reads('ADMIN_DEV_BYPASS')],
  ...(e2e ? [] : [['ADMIN_TEST_AUTH', reads('ADMIN_TEST_AUTH')], ['CF_ANALYTICS_FIXTURE', reads('CF_ANALYTICS_FIXTURE')]]),
]
const offenders = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (/\.(c|m)?js$/.test(name)) {
      const source = readFileSync(path, 'utf8')
      for (const [variable, pattern] of forbidden) if (pattern.test(source)) offenders.push(`${path} reads ${variable}`)
    }
  }
}

if (worker) {
  // A missing bundle must fail: passing would mean nothing was checked.
  walk(dist)
} else {
  for (const root of [join(dist, 'server'), join(dist, 'static')]) {
    try {
      walk(root)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
}

if (offenders.length > 0) {
  console.error('A test-only switch survived the production build:\n' + offenders.map((line) => `  ${line}`).join('\n'))
  process.exit(1)
}
console.log(`check-no-dev-bypass: ${forbidden.map(([name]) => name).join(' and ')} compiled out of ${dist}.`)
