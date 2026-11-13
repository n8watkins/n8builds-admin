import { expect, test } from '@playwright/test'

// The Newsletter page as n8builds-web is until the owner sets the Kit key
// (ANNOUNCE_FIXTURE=empty, lib/newsletter-fixture.ts): it says plainly that the
// newsletter stays off, and "Turn newsletter on" waits for the key.

test('Without the Kit key the newsletter stays off, and the on button is disabled with the reason', async ({ page }) => {
  await page.goto('/newsletter')
  const panel = page.locator('#switch')
  await expect(panel.getByRole('status').filter({ hasText: "The Kit key isn't set on n8builds-web, so the newsletter stays off." })).toBeVisible()
  await expect(panel.getByText('Off', { exact: true })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Turn newsletter on' })).toBeDisabled()
  await expect(panel.getByText('Needs the Kit key on n8builds-web first.')).toBeVisible()
  await expect(page.locator('#kit')).toContainText('Not set')
})
