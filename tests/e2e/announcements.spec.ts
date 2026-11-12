import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The Announcements page against a made-up n8builds-web (ANNOUNCE_FIXTURE=1,
// lib/announce-fixture.ts) that never sends an email: Feelium (214 confirmed,
// never announced), Solara (96) and Wren (41) can be picked; Pivot was
// announced 20 minutes ago and is sending, KeysReady 12 days ago and is paused
// at the monthly cap; Asset Arsenal has nobody confirmed. n8builds-web has 145
// emails left this month. The tests share that state, so they run in order.

test.describe.configure({ mode: 'serial' })

async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
}

/** Fails the test on any CSP violation (the preview iframe must not trip frame-src). */
async function watchErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      throw new Error(`CSP blocked ${e.violatedDirective} ${e.blockedURI}`)
    })
  })
  return errors
}

const projectRadio = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(`^${name}\\b`) })

async function fill(page: Page, headline: string) {
  await page.getByLabel('Headline', { exact: true }).fill(headline)
  await page.getByLabel('What is ready', { exact: true }).fill('The first version is ready to try.\n\nTell me what you think.')
  await page.getByLabel('Link', { exact: true }).fill('https://n8builds.dev/upcoming')
}

test('History: each state with its progress, error and Cancel only where it can stop', async ({ page }) => {
  const errors = await watchErrors(page)
  await page.goto('/announcements?tab=history')
  await settle(page)
  await expect(page.getByRole('heading', { level: 2, name: 'Announcements, newest first' })).toBeVisible()
  // The two still going are counted on the tab.
  await expect(page.getByRole('navigation', { name: 'Announcements sections' }).getByRole('link', { name: /^History/ })).toContainText('2')

  const row = (project: string) => page.getByRole('listitem', { name: new RegExp(`^${project}:`) })
  await expect(row('Pivot').getByText('Sending', { exact: true })).toBeVisible()
  await expect(row('Pivot').getByText('31 of 58 sent')).toBeVisible()
  await expect(row('Pivot').getByRole('meter')).toHaveAttribute('aria-valuenow', '32')
  await expect(row('KeysReady').getByText(/^Paused at the cap until [A-Z][a-z]{2} 1(, \d{4})?, 06:00 UTC$/)).toBeVisible()
  await expect(row('KeysReady').getByText(/Last error: month_cap/)).toBeVisible()
  await expect(row('Solara').getByText('Done, 2 failed')).toBeVisible()
  await expect(row('Wren').getByText('Cancelled', { exact: true })).toBeVisible()
  for (const project of ['Pivot', 'KeysReady']) await expect(row(project).getByRole('button', { name: `Cancel the ${project} announcement` })).toBeVisible()
  for (const project of ['Solara', 'Wren']) await expect(row(project).getByRole('button')).toHaveCount(0)
  // Pivot is sending, so the page keeps itself up to date.
  await expect(page.getByText('Updates every 5 seconds while sending.')).toBeVisible()
  expect(errors).toEqual([])
})

test('Compose: the picker, the allowance warning, live counts and preview, and a test to yourself', async ({ page }) => {
  const errors = await watchErrors(page)
  await page.goto('/announcements')
  await settle(page)
  await expect(page.getByRole('heading', { level: 2, name: 'New announcement' })).toBeVisible()

  // The 30-day rule and nobody to send to.
  await expect(projectRadio(page, 'KeysReady')).toBeDisabled()
  await expect(page.getByText(/^Announced [A-Z][a-z]{2} \d+; opens again [A-Z][a-z]{2} \d+$/).first()).toBeVisible()
  await expect(projectRadio(page, 'Pivot')).toBeDisabled()
  await expect(projectRadio(page, 'Asset Arsenal')).toBeDisabled()
  await expect(page.getByText('No one confirmed yet')).toBeVisible()
  // The biggest list that can be picked comes first, and is picked.
  await expect(projectRadio(page, 'Feelium')).toBeChecked()
  await expect(page.getByText('214 people confirmed')).toBeVisible()

  // n8builds-web's allowance, and the warning that 214 runs past it.
  await expect(page.getByText(/145\s*left of 600/)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'more than the 145 emails n8builds-web has left this month' })).toContainText('pauses at the cap and resumes on its own')

  // Nothing can be sent before every field is filled in.
  await expect(page.getByRole('button', { name: 'Send test to me' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Send to 214 people' })).toBeDisabled()

  await page.getByLabel('Headline', { exact: true }).fill('Feelium is open')
  await expect(page.getByText('15 / 80')).toBeVisible()
  await fill(page, 'Feelium is open')
  // The live preview, rendered by n8builds-web, in a sandboxed frame.
  const frame = page.frameLocator('iframe[title="Email preview"]')
  await expect(frame.getByRole('heading', { name: 'Feelium is open' })).toBeVisible()
  await expect(page.locator('iframe[title="Email preview"]')).toHaveAttribute('sandbox', '')
  // The subject, as n8builds-web writes it.
  await expect(page.getByRole('definition').filter({ hasText: /^Feelium is open$/ })).toBeVisible()
  await expect(page.getByText('214 people on the Feelium waitlist')).toBeVisible()
  // It follows the typing.
  await page.getByLabel('Headline', { exact: true }).fill('Feelium is open to all')
  await expect(frame.getByRole('heading', { name: 'Feelium is open to all' })).toBeVisible()

  // Over the limit: red, and nothing can go out.
  await page.getByLabel('Headline', { exact: true }).fill('x'.repeat(81))
  await expect(page.getByText('81 / 80')).toBeVisible()
  await expect(page.getByLabel('Headline', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByRole('button', { name: 'Send to 214 people' })).toBeDisabled()
  await page.getByLabel('Headline', { exact: true }).fill('Feelium is open')

  await page.getByRole('button', { name: 'Send test to me' }).click()
  await expect(page.getByText('Test sent to your inbox.')).toBeVisible()

  // Switching templates keeps the words.
  await page.getByText('Progress update', { exact: true }).click()
  await expect(page.getByLabel('Headline', { exact: true })).toHaveValue('Feelium is open')
  await expect(page.getByLabel('Link', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('What changed', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('Send: the dialog says who gets it and that it can\'t be unsent, then it shows under History', async ({ page }) => {
  await page.goto('/announcements')
  await settle(page)
  // Solara or, on a retry after Solara was sent, Wren.
  const name = (await projectRadio(page, 'Solara').isEnabled()) ? 'Solara' : 'Wren'
  const count = name === 'Solara' ? 96 : 41
  await projectRadio(page, name).check()
  // It fits this month: no warning.
  await expect(page.getByRole('status').filter({ hasText: 'left this month' })).toHaveCount(0)
  await fill(page, `${name} is open`)
  await expect(page.frameLocator('iframe[title="Email preview"]').getByRole('heading', { name: `${name} is open` })).toBeVisible()

  await page.getByRole('button', { name: `Send to ${count} people` }).click()
  const dialog = page.getByRole('dialog', { name: `Send to ${count} people?` })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(`Everyone who confirmed the ${name} waitlist (${count} people) gets “${name} is open” by email from n8builds.dev.`)
  await expect(dialog).toContainText('It can\'t be unsent.')
  // Backing out sends nothing.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: `Send to ${count} people` }).click()
  await dialog.getByRole('button', { name: 'Send it' }).click()
  await expect(page).toHaveURL(/\/announcements\?tab=history$/)
  await expect(page.getByRole('listitem', { name: `${name}: ${name} is open` })).toBeVisible()

  // And it can't be picked again for 30 days.
  await page.goto('/announcements')
  await expect(projectRadio(page, name)).toBeDisabled()
})

test('Cancel stops a paused send', async ({ page }) => {
  await page.goto('/announcements?tab=history')
  await settle(page)
  const row = page.getByRole('listitem', { name: /^KeysReady:/ })
  await row.getByRole('button', { name: 'Cancel the KeysReady announcement' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancel the KeysReady announcement?' })
  await expect(dialog).toContainText('140 people already have it')
  await dialog.getByRole('button', { name: 'Stop sending' }).click()
  await expect(row.getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: /^Cancel the/ })).toHaveCount(0)
})

test('the Overview tile shows the one going out', async ({ page }) => {
  await page.goto('/')
  await settle(page)
  const tile = page.getByTestId('tile-announcements')
  await expect(tile).toHaveAttribute('href', '/announcements')
  await expect(tile.getByRole('meter')).toBeVisible()
  await expect(tile).toContainText(/Sending: (Solara|Wren|Pivot)/)
})

for (const tab of ['', '?tab=history']) {
  test(`no axe violations (WCAG 2.1 AA) on ${tab || 'Compose'}`, async ({ page }) => {
    await page.goto(`/announcements${tab}`)
    await settle(page)
    if (!tab) await fill(page, 'Feelium is open')
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([])
  })

  for (const width of [375, 320]) {
    test(`no sideways scroll at ${width}px on ${tab || 'Compose'}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(`/announcements${tab}`)
      await settle(page)
      if (!tab) {
        await fill(page, 'Feelium is open')
        await expect(page.frameLocator('iframe[title="Email preview"]').getByRole('heading', { name: 'Feelium is open' })).toBeVisible()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    })
  }
}
