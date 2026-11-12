import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The Announcements page as n8builds-web is today: every project on
// /upcoming, nobody confirmed on any of them yet, no announcement sent
// (ANNOUNCE_FIXTURE=empty, lib/announce-fixture.ts).

async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
}

test('Compose with nobody confirmed: every project says so, and Send is off with the reason', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/announcements')
  await settle(page)

  const radios = page.getByRole('radio', { name: /confirmed/ })
  expect(await radios.count()).toBeGreaterThan(1)
  for (const radio of await radios.all()) await expect(radio).toBeDisabled()
  await expect(page.getByText('No one confirmed yet')).toHaveCount(await radios.count())
  await expect(page.getByRole('status').filter({ hasText: 'No one has confirmed a spot on any waitlist yet, so there is no one to send to.' })).toBeVisible()

  // Nothing to fill in or preview, and the reason under the buttons.
  await expect(page.getByRole('radio', { name: "It's open" })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Send test to me' })).toBeDisabled()
  await expect(page.locator('main').getByText('No one has confirmed a spot on any waitlist yet, so there is no one to send to.', { exact: true })).toBeVisible()
  await expect(page.getByText('Nothing to preview until a project can be picked.')).toBeVisible()
  // Nothing sent yet: what is left is only capped by n8builds-web's slice.
  await expect(page.getByText(/^about \d+ left of 140$/)).toBeVisible()
  expect(errors).toEqual([])
})

test('History and the Overview tile with none sent yet', async ({ page }) => {
  await page.goto('/announcements?tab=history')
  await settle(page)
  await expect(page.getByText('No announcement yet. The first one shows here as soon as it starts.')).toBeVisible()
  await page.goto('/')
  await settle(page)
  const tile = page.getByTestId('tile-announcements')
  await expect(tile).toContainText('None yet')
  await expect(tile).toHaveAttribute('href', '/announcements')
})

test('no axe violations, and no sideways scroll at 375px', async ({ page }) => {
  await page.goto('/announcements')
  await settle(page)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([])
  await page.setViewportSize({ width: 375, height: 800 })
  await page.goto('/announcements')
  await settle(page)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
})
