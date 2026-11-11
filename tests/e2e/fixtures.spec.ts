import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The Cloudflare usage page with made-up numbers (CF_ANALYTICS_FIXTURE=1,
// lib/cloudflare-usage-fixture.ts): requests project to 46% of the included
// 10 million, CPU time to 78% of the 30 million ms, Workers AI is at 3,140
// neurons today. Set CF_USAGE_SHOTS to a folder to save screenshots there.

const shots = process.env.CF_USAGE_SHOTS
// The projection only counts after the month's first day (UTC).
const projectionCounts = new Date().getUTCDate() > 1

async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
}

test('the page shows both allowances, the projection, each Worker and Workers AI', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/cloudflare')
  await settle(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Cloudflare usage' })).toBeVisible()

  const workers = page.getByRole('region', { name: /^Workers in / })
  const requests = workers.getByRole('group', { name: 'Requests', exact: true })
  await expect(requests.getByText('On track')).toBeVisible()
  await expect(requests.getByRole('meter')).toHaveAttribute('aria-valuemax', '10000000')
  const cpu = workers.getByRole('group', { name: 'CPU time', exact: true })
  await expect(cpu.getByRole('meter')).toHaveAttribute('aria-valuemax', '30000000')
  if (projectionCounts) await expect(cpu.getByText('78% projected')).toBeVisible()

  // Busiest Worker (by CPU time) first.
  const rows = workers.getByRole('table').getByRole('row')
  await expect(rows.nth(1)).toContainText('n8builds-web')
  await expect(rows.nth(2)).toContainText('portfolio-rank')

  const ai = page.getByRole('region', { name: 'Workers AI today' })
  await expect(ai.getByText('3,140', { exact: true })).toBeVisible()
  await expect(ai.getByText('/ 10,000')).toBeVisible()
  await expect(ai.getByText(/PortfolioRank stops itself at 2,500/)).toBeVisible()
  await expect(ai.getByText('black-forest-labs/flux-1-schnell')).toBeVisible()

  await expect(page.getByRole('region', { name: 'Email' }).getByRole('link', { name: /Open Mailroom/ })).toHaveAttribute('href', '/mailroom')
  expect(errors).toEqual([])
  if (shots) await page.screenshot({ path: `${shots}/cfusage-desktop.png`, fullPage: true })
})

test('the Overview tile and its "Needs attention" chip', async ({ page }) => {
  await page.goto('/')
  await settle(page)
  const tile = page.getByTestId('tile-cloudflare')
  await expect(tile).toHaveAttribute('href', '/cloudflare')
  await expect(tile.getByRole('meter')).toBeVisible()
  if (projectionCounts) {
    await expect(tile).toContainText('78%')
    await expect(page.getByRole('region', { name: 'Needs attention' }).getByRole('link', { name: 'Cloudflare usage: CPU 78% projected' })).toHaveAttribute('href', '/cloudflare')
  }
  if (shots) await page.screenshot({ path: `${shots}/cfusage-overview.png`, fullPage: true })
})

test('no axe violations (WCAG 2.1 AA)', async ({ page }) => {
  await page.goto('/cloudflare')
  await settle(page)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([])
})

for (const width of [375, 320]) {
  test(`no sideways scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/cloudflare')
    await settle(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    if (shots && width === 375) await page.screenshot({ path: `${shots}/cfusage-mobile.png`, fullPage: true })
  })
}
