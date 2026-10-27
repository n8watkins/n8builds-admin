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

  test('pages explain themselves: "What this is and why it matters"', async ({ page }) => {
    for (const { path } of PAGES.filter((item) => item.path !== '/' && item.path !== '/setup')) {
      await page.goto(path)
      await expect(page.getByRole('region', { name: 'What this is and why it matters' })).toBeVisible()
    }
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
    await page.goto('/setup')
    for (const id of ['sign-in', 'github', 'ga4', 'sentry', 'upstash', 'vercel', 'ai-bots']) {
      await expect(page.locator(`li#${id} h2`)).toBeVisible()
    }
    await expect(page.getByText(/of 6 done/)).toBeVisible()
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
