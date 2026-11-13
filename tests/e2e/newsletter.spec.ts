import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// The Newsletter page against a made-up n8builds-web with the Kit key set
// (ANNOUNCE_FIXTURE=1, lib/newsletter-fixture.ts): off by default, then
// turned on and off again through the confirmation dialog.

test('Turn newsletter on/off: off by default, each change confirmed and logged with who and when', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/newsletter')
  await expect(page.getByRole('heading', { level: 1, name: 'Newsletter' })).toBeVisible()

  const panel = page.locator('#switch')
  await expect(panel.getByText('Off', { exact: true })).toBeVisible()
  await expect(panel.getByText('Never changed: off by default.')).toBeVisible()
  await expect(panel.getByText("The Kit key isn't set")).toHaveCount(0)

  await panel.getByRole('button', { name: 'Turn newsletter on' }).click()
  const dialog = page.getByRole('dialog', { name: 'Turn the newsletter on?' })
  await expect(dialog).toContainText('waitlist sign-ups go to Kit')
  await dialog.getByRole('button', { name: 'Turn on' }).click()
  await expect(panel.getByText('The newsletter is on.')).toBeVisible()
  await expect(panel.getByText('On', { exact: true })).toBeVisible()
  await expect(panel).toContainText(/Turned on by \S+, Nov|Turned on by \S+, \w{3} \d/)
  await expect(panel.getByRole('listitem')).toHaveCount(1)

  // Kit's side, and the way to it.
  const kit = page.locator('#kit')
  await expect(kit).toContainText('Confirmed in Kit')
  await expect(kit).toContainText('37')
  await expect(kit.getByRole('link', { name: /Open Kit/ })).toHaveAttribute('href', 'https://app.kit.com')

  await panel.getByRole('button', { name: 'Turn newsletter off' }).click()
  await page.getByRole('dialog', { name: 'Turn the newsletter off?' }).getByRole('button', { name: 'Turn off' }).click()
  await expect(panel.getByText('The newsletter is off.')).toBeVisible()
  await expect(panel.getByRole('listitem')).toHaveCount(2)

  const axe = await new AxeBuilder({ page }).include('main').analyze()
  expect(axe.violations).toEqual([])
  expect(errors).toEqual([])
})
