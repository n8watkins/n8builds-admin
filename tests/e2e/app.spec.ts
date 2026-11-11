import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { PAGES } from './pages'

// The E2E build with the test-only sign-in stub: every page as the owner.

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test.describe('pages', () => {
  for (const { path, heading } of PAGES) {
    test(`${path} renders its heading, context and no errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      // Any CSP violation (lib/security/csp.ts) counts as an error.
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          throw new Error(`CSP blocked ${e.violatedDirective} ${e.blockedURI}`)
        })
      })
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
      // Every panel finishes streaming: no loading skeleton left behind.
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
      await expect(page.getByRole('alert').filter({ hasText: /Something went wrong/ })).toHaveCount(0)
      expect(errors).toEqual([])
    })

    test(`${path} has no axe violations (WCAG 2.1 AA)`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([])
    })
  }

  test('pages explain themselves: one line under the title, and About on demand', async ({ page }) => {
    for (const { path } of PAGES.filter((item) => item.path !== '/')) {
      await page.goto(path)
      const header = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::header')
      // The old always-open box is gone everywhere.
      await expect(page.getByRole('region', { name: 'What this is and why it matters' }), path).toHaveCount(0)
      const about = page.locator('header details > summary').filter({ hasText: 'About' })
      await expect(about, path).toHaveCount(1)
      // The compact header: one line, and the facts only once About is opened.
      await expect(header.getByRole('listitem').first(), path).toBeHidden()
      await about.click()
      await expect(header.getByRole('listitem').first(), path).toBeVisible()
    }
  })
})

test.describe('overview', () => {
  test('needs attention is one row of chips (or All clear), then one tile per section', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
    await expect(page.getByText(/refreshes every 5 minutes/)).toBeVisible()
    const attention = page.getByRole('region', { name: 'Needs attention' })
    if ((await attention.count()) > 0) {
      const chips = attention.getByRole('link')
      expect(await chips.count()).toBeGreaterThan(0)
      // Each chip goes to its section.
      for (const chip of await chips.all()) expect(await chip.getAttribute('href')).toMatch(/^\/[a-z]+$/)
    } else {
      await expect(page.getByText('All clear', { exact: true })).toBeVisible()
    }
    // Grouped like the sidebar.
    for (const group of ['GitHub', 'Sites', 'Counters', 'People', 'Apps', 'Setup']) {
      await expect(page.getByRole('heading', { level: 2, name: group, exact: true })).toBeVisible()
    }
    // One tile per section: a link to the section or, not connected yet, to its Setup item.
    for (const { path } of PAGES.filter((item) => item.path !== '/')) {
      // App stats has one tile per app (tile-apps-nettrailers); every other section has one.
      const tile = path === '/apps' ? page.locator('[data-testid^="tile-apps-"]').first() : page.getByTestId(`tile-${path.slice(1)}`)
      await expect(tile, path).toHaveCount(1)
      const href = (await tile.getAttribute('href')) ?? ''
      if ((await tile.textContent())?.includes('Connect')) expect(href, path).toMatch(/^\/setup(#[a-z0-9-]+)?$/)
      else expect(href, path).toBe(path)
    }
    // The old strip, long cards and the separate "Not connected yet" list are gone.
    await expect(page.getByRole('heading', { name: 'Not connected yet' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'At a glance' })).toHaveCount(0)
  })

  test('a tile opens its section', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
    await page.getByTestId('tile-setup').click()
    await expect(page).toHaveURL(/\/setup$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Setup', exact: true })).toBeVisible()
  })
})

type TabCase = readonly [label: string, query: string | null, heading: string | null]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Clicks through a page's tabs: each has its own address, is the one marked current, and shows its section. */
async function checkTabs(page: Page, path: string, nav: string, tabs: readonly TabCase[]) {
  await page.goto(path)
  const links = page.getByRole('navigation', { name: nav })
  await expect(links.getByRole('link')).toHaveCount(tabs.length)
  for (const [label, query, heading] of [...tabs.slice(1), tabs[0]]) {
    const link = links.getByRole('link', { name: new RegExp(`^${escape(label)}`) })
    await link.click()
    await expect(page).toHaveURL(new RegExp(query ? `${path}\\?tab=${query}$` : `${path}$`))
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(links.locator('[aria-current="page"]')).toHaveCount(1)
    if (heading) await expect(page.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible()
  }
  // An unknown tab falls back to the first.
  await page.goto(`${path}?tab=nope`)
  await expect(links.getByRole('link', { name: new RegExp(`^${escape(tabs[0][0])}`) })).toHaveAttribute('aria-current', 'page')
}

test.describe('tabs', () => {
  test('Stars and traffic: By repo, Over time', async ({ page }) => {
    await checkTabs(page, '/repos', 'Stars and traffic sections', [
      ['By repo', null, 'By repo'],
      ['Over time', 'trends', 'Over time'],
    ])
  })

  test('Releases and deploys: Latest, This month, Previews', async ({ page }) => {
    await checkTabs(page, '/releases', 'Releases and deploys sections', [
      ['Latest', null, 'Latest by project'],
      ['This month', 'month', 'This month'],
      ['Previews', 'previews', 'Preview deploys'],
    ])
  })

  test('Website traffic: Visitors, AI crawlers', async ({ page }) => {
    await checkTabs(page, '/traffic', 'Website traffic sections', [
      ['Visitors', null, 'The last 28 days'],
      ['AI crawlers', 'crawlers', 'AI crawlers'],
    ])
  })

  test('Waitlist: Summary, Sign-ups, Bcc lists', async ({ page }) => {
    await checkTabs(page, '/waitlist', 'Waitlist sections', [
      ['Summary', null, 'Confirmed per project'],
      ['Sign-ups', 'signups', 'Sign-ups, newest first'],
      ['Bcc lists', 'bcc', 'Bcc lists'],
    ])
  })

  test('Newsletter: Summary, Digests, Skipped weeks, Subscribers', async ({ page }) => {
    await checkTabs(page, '/newsletter', 'Newsletter sections', [
      ['Summary', null, 'Readers and the last digest'],
      ['Digests', 'digests', 'Recent digests'],
      ['Skipped weeks', 'skipped', 'Skipped weeks'],
      ['Subscribers', 'subscribers', 'Subscribers, newest first'],
    ])
  })

  test('Setup: To do, Done', async ({ page }) => {
    await checkTabs(page, '/setup', 'Setup sections', [
      ['To do', null, null],
      ['Done', 'done', null],
    ])
  })

  test('Mailroom: its sections are tabs with their own addresses', async ({ page }) => {
    await page.goto('/mailroom')
    const tabs = page.getByRole('navigation', { name: 'Mailroom sections' })
    await expect(tabs.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    for (const [name, query, title] of [
      ['Sends', 'sends', 'Recent sends'],
      ['Bounces & complaints', 'problems', 'Bounces and complaints'],
      ['Suppressions', 'suppressions', 'Suppression list'],
      ['Apps & caps', 'apps', 'Apps and caps'],
      ['Audit log', 'audit', 'Audit log'],
    ] as const) {
      await tabs.getByRole('link', { name: new RegExp(`^${name.replace('&', '\\&')}`) }).click()
      await expect(page).toHaveURL(new RegExp(`/mailroom\\?tab=${query}$`))
      await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible()
      await expect(tabs.getByRole('link', { name: new RegExp(`^${name.replace('&', '\\&')}`) })).toHaveAttribute('aria-current', 'page')
    }
    // An unknown tab falls back to the overview.
    await page.goto('/mailroom?tab=nope')
    await expect(page.getByRole('heading', { level: 2, name: 'This month at a glance', exact: true })).toBeVisible()
  })
})

test.describe('navigation', () => {
  test('the sidebar reaches every page and marks the current one', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Dashboard' })
    for (const { path, heading } of PAGES) {
      await nav.getByRole('link', { name: new RegExp(`^${heading}`) }).click()
      await expect(page).toHaveURL(new RegExp(`${path === '/' ? '/$' : `${path}$`}`))
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible()
      await expect(nav.getByRole('link', { name: new RegExp(`^${heading}`) })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('the sidebar links n8builds.dev and the portfolio', async ({ page }) => {
    await page.goto('/')
    for (const href of ['https://n8builds.dev', 'https://portfolio.n8builds.dev']) {
      const link = page.locator(`aside a[href="${href}"]`)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noreferrer/)
    }
  })

  for (const { path } of PAGES) {
    test(`${path}: links to other sites open in a new tab, say so, and have a name`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
      // Open folded sections (preview deploys, setup steps) so every link is checked.
      for (const details of await page.locator('main details:not([open]):visible').all()) await details.locator('summary').click()
      const links = await page.locator('main a[href^="http"]').all()
      for (const link of links) {
        const href = (await link.getAttribute('href')) ?? ''
        expect(await link.getAttribute('target'), href).toBe('_blank')
        expect(await link.getAttribute('rel'), href).toMatch(/noreferrer/)
        expect((await link.textContent())?.trim(), href).toMatch(/\S/)
        expect(await link.textContent(), href).toMatch(/new tab/)
      }
      // Links inside the admin never open a new tab.
      for (const link of await page.locator('main a[href^="/"]').all()) expect(await link.getAttribute('target')).toBeNull()
    })
  }

  test('the Setup page lists every item with a status', async ({ page }) => {
    // Every item is under To do or Done, never both.
    const shown: string[] = []
    for (const path of ['/setup', '/setup?tab=done']) {
      await page.goto(path)
      await expect(page.getByText(/of 7 done/)).toBeVisible()
      for (const item of await page.locator('main li[id]:has(h2)').all()) {
        await expect(item.getByText(/Connected|Live|Not connected|Not deployed yet|missing|Bypassed locally|Needs Plan|Secret too short|Check in Cloudflare/).first()).toBeVisible()
        shown.push((await item.getAttribute('id')) ?? '')
      }
    }
    expect(shown.sort()).toEqual(['ai-bots', 'cloudflare-deploys', 'databases', 'github', 'ga4', 'hosting', 'sentry', 'sign-in'].sort())
  })
})

test.describe('phones', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the menu opens, navigates and closes', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('aside')).toBeHidden()
    const menu = page.getByRole('button', { name: /Menu/ })
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await menu.click()
    await expect(page.getByRole('button', { name: 'Close the menu' })).toHaveAttribute('aria-expanded', 'true')
    await page.locator('#mobile-menu').getByRole('link', { name: /^Security alerts/ }).click()
    await expect(page).toHaveURL(/\/security$/)
    await expect(page.locator('#mobile-menu')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Security alerts' })).toBeVisible()
  })

  for (const width of [375, 320]) {
    test(`no page scrolls sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      for (const { path } of PAGES) {
        await page.goto(path)
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
        expect(await horizontalOverflow(page), `${path} at ${width}px`).toBeLessThanOrEqual(0)
      }
    })
  }
})
