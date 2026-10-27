// Lighthouse budgets for the admin's E2E production build (run `npm run build:e2e` first).
//
// Starts `next start` on the E2E build with the test-only sign-in stub
// (lib/auth/test-auth.ts, never in a real deploy), warms each page once (the
// owner normally sees cached data), then audits each page several times with
// Lighthouse's desktop preset and a few with its mobile preset, and checks the
// median of every metric. Writes the median run's HTML report per page to
// .lighthouse/. Exits 1 if an "error" budget fails; "warn" budgets only print.
// SEO isn't budgeted: the admin is noindex on purpose.
//
// Env: LIGHTHOUSE_PORT (default 3833), CHROME_PATH (needed under WSL: a Linux
// Chrome, e.g. Playwright's ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome),
// GITHUB_TOKEN (so the GitHub pages have data, as in real use).

import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse, { desktopConfig } from 'lighthouse'

const PORT = Number(process.env.LIGHTHOUSE_PORT) || 3833
const BASE = `http://localhost:${PORT}`
const PAGES = ['/', '/ci', '/minutes', '/repos', '/releases', '/security', '/demos', '/errors', '/setup']
const RUNS = 3
const RETRIES = 2
const REPORT_DIR = '.lighthouse'

/** [label, read(lhr), level, limit, direction] */
const BUDGETS = [
  ['performance', (lhr) => lhr.categories.performance.score, 'error', 0.9, 'min'],
  ['accessibility', (lhr) => lhr.categories.accessibility.score, 'error', 0.95, 'min'],
  ['best practices', (lhr) => lhr.categories['best-practices'].score, 'warn', 0.9, 'min'],
  ['FCP (ms)', (lhr) => lhr.audits['first-contentful-paint'].numericValue, 'error', 1800, 'max'],
  ['LCP (ms)', (lhr) => lhr.audits['largest-contentful-paint'].numericValue, 'error', 2500, 'max'],
  ['CLS', (lhr) => lhr.audits['cumulative-layout-shift'].numericValue, 'error', 0.1, 'max'],
  ['TBT (ms)', (lhr) => lhr.audits['total-blocking-time'].numericValue, 'warn', 200, 'max'],
]

// Lighthouse's default mobile form factor: a mid-range phone on slow 4G with a 4x slower CPU.
const MOBILE_PAGES = ['/', '/ci', '/setup']
const MOBILE_BUDGETS = [
  ['performance', (lhr) => lhr.categories.performance.score, 'error', 0.8, 'min'],
  ['accessibility', (lhr) => lhr.categories.accessibility.score, 'error', 0.95, 'min'],
  ['LCP (ms)', (lhr) => lhr.audits['largest-contentful-paint'].numericValue, 'error', 4000, 'max'],
  ['CLS', (lhr) => lhr.audits['cumulative-layout-shift'].numericValue, 'error', 0.1, 'max'],
  ['TBT (ms)', (lhr) => lhr.audits['total-blocking-time'].numericValue, 'warn', 400, 'max'],
]

const FORMS = [
  { name: 'desktop', config: desktopConfig, pages: PAGES, budgets: BUDGETS, runs: RUNS },
  { name: 'mobile', config: undefined, pages: MOBILE_PAGES, budgets: MOBILE_BUDGETS, runs: RUNS },
]

const CATEGORIES = ['performance', 'accessibility', 'best-practices']

function runProblem(result, budgets) {
  if (!result) return 'no result'
  const { lhr } = result
  if (lhr.runtimeError) return `${lhr.runtimeError.code}: ${lhr.runtimeError.message}`
  const empty = budgets.filter(([, read]) => typeof read(lhr) !== 'number').map(([label]) => label)
  return empty.length ? `no value for ${empty.join(', ')}` : null
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

async function waitForServer(server) {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(`next start exited with code ${server.exitCode}`)
    try {
      if ((await fetch(`${BASE}/robots.txt`)).ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Server did not start on ${BASE}`)
}

/** The test stub must be on, or every page would just redirect to /login. */
async function assertSignedIn() {
  const response = await fetch(`${BASE}/`, { redirect: 'manual' })
  if (response.status !== 200) {
    throw new Error(`/ answered ${response.status}: run \`npm run build:e2e\` first (the E2E build has the test sign-in stub).`)
  }
}

async function launchChrome(profile, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    const dir = join(profile, `attempt-${attempt}`)
    mkdirSync(dir)
    try {
      return await chromeLauncher.launch({
        userDataDir: dir,
        chromeFlags: ['--headless=new', `--user-data-dir=${dir}`, ...(process.env.CI ? ['--no-sandbox'] : [])],
        maxConnectionRetries: 60,
      })
    } catch (error) {
      if (attempt >= attempts) throw error
      console.warn(`Chrome did not start (attempt ${attempt} of ${attempts}): ${error.message}; retrying`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
}

async function main() {
  const server = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], {
    stdio: ['ignore', 'ignore', 'inherit'],
    detached: true,
    env: { ...process.env, ADMIN_E2E_BUILD: '1', ADMIN_TEST_AUTH: '1' },
  })
  const profile = mkdtempSync(join(tmpdir(), 'lighthouse-'))
  let chrome
  let failed = false
  const summary = []

  try {
    await waitForServer(server)
    await assertSignedIn()
    for (const path of PAGES) await fetch(`${BASE}${path}`)
    chrome = await launchChrome(profile)
    mkdirSync(REPORT_DIR, { recursive: true })

    for (const form of FORMS) for (const path of form.pages) {
      const runs = []
      for (let i = 0; i < form.runs; i++) {
        let result
        for (let attempt = 0; attempt <= RETRIES; attempt++) {
          result = await lighthouse(`${BASE}${path}`, { port: chrome.port, output: 'html', logLevel: 'error', onlyCategories: CATEGORIES }, form.config)
          const problem = runProblem(result, form.budgets)
          if (!problem) break
          console.log(`  retry ${path} (${form.name}) run ${i + 1}: ${problem}`)
          if (attempt === RETRIES) throw new Error(`Lighthouse could not audit ${path} (${form.name}): ${problem}`)
        }
        runs.push(result)
      }

      console.log(`\n${path} (${form.name})`)
      const row = { page: path, form: form.name }
      for (const [label, read, level, limit, direction] of form.budgets) {
        const value = median(runs.map((run) => read(run.lhr)))
        row[label] = value
        const ok = direction === 'min' ? value >= limit : value <= limit
        if (!ok && level === 'error') failed = true
        const shown = Number.isInteger(limit) ? Math.round(value) : value.toFixed(3)
        const status = ok ? 'ok  ' : level === 'error' ? 'FAIL' : 'warn'
        console.log(`  ${status} ${label.padEnd(15)} ${String(shown).padStart(6)}  (${direction} ${limit})`)
      }
      summary.push(row)

      const medianScore = median(runs.map((run) => run.lhr.categories.performance.score))
      const report = runs.find((run) => run.lhr.categories.performance.score === medianScore).report
      const name = `${path === '/' ? 'overview' : path.slice(1).replaceAll('/', '_')}-${form.name}`
      writeFileSync(join(REPORT_DIR, `${name}.html`), report)
    }
    writeFileSync(join(REPORT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
  } finally {
    await chrome?.kill()
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      // Already gone.
    }
    rmSync(profile, { recursive: true, force: true })
  }

  console.log(failed ? '\nLighthouse budgets failed.' : `\nAll error budgets passed. Reports: ${REPORT_DIR}/`)
  process.exit(failed ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
