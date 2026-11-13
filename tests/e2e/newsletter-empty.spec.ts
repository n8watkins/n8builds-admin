import { expect, test } from '@playwright/test'

// The Newsletter page as n8builds-web is until the owner sets the Kit key
// (ANNOUNCE_FIXTURE=empty, lib/newsletter-fixture.ts): the switch can be set,
// and the page says plainly that the newsletter stays off until the key is there.

test('Without the Kit key the page says the newsletter stays off, even when switched on', async ({ page }) => {
  await page.goto('/newsletter')
  const panel = page.locator('#switch')
  await expect(panel.getByRole('status').filter({ hasText: "The Kit key isn't set on n8builds-web, so the newsletter stays off." })).toBeVisible()
  await expect(page.locator('#kit')).toContainText('Not set')

  await panel.getByRole('button', { name: 'Turn newsletter on' }).click()
  const dialog = page.getByRole('dialog', { name: 'Turn the newsletter on?' })
  await expect(dialog).toContainText('nothing shows on n8builds.dev until the Kit key is set')
  await dialog.getByRole('button', { name: 'Turn on' }).click()
  await expect(panel.getByText('On, waiting for the Kit key')).toBeVisible()
  await expect(panel.getByRole('status').filter({ hasText: 'stays off even with the switch on' })).toBeVisible()

  // Put it back, so a rerun against the same server starts from off.
  await panel.getByRole('button', { name: 'Turn newsletter off' }).click()
  await page.getByRole('dialog', { name: 'Turn the newsletter off?' }).getByRole('button', { name: 'Turn off' }).click()
  await expect(panel.getByText('The newsletter is off.')).toBeVisible()
})
