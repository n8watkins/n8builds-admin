import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The Announcements page against a made-up n8builds-web (ANNOUNCE_FIXTURE=1,
// lib/announce-fixture.ts) that checks like the real one and never sends an
// email: Feelium (214 confirmed, never announced), Wren (41) and Solara (26)
// can be picked; Pivot was announced today and is sending, KeysReady a few
// days ago and is paused at today's 40; Asset Arsenal has nobody confirmed.
// The tests share that state, so they run in order.

test.describe.configure({ mode: 'serial' })

async function settle(page: Page) {
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 30_000 })
}

/** Fails the test on any CSP violation (the preview iframe must not trip it). */
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
const field = (page: Page, label: string) => page.getByLabel(new RegExp(`^${label.replace(/[()]/g, '\\$&')}`))
const frame = (page: Page) => page.frameLocator('iframe[title="Email preview"]')
const sendButton = (page: Page) => page.getByRole('button', { name: /^Send( to \d+ (people|person))?$/ })

test('History: each state with its progress, who started it, why it paused, and Cancel only where it can stop', async ({ page }) => {
  const errors = await watchErrors(page)
  await page.goto('/announcements?tab=history')
  await settle(page)
  await expect(page.getByRole('heading', { level: 2, name: 'Announcements, newest first' })).toBeVisible()
  // The two still going are counted on the tab.
  await expect(page.getByRole('navigation', { name: 'Announcements sections' }).getByRole('link', { name: /^History/ })).toContainText('2')

  const row = (project: string) => page.getByRole('listitem', { name: new RegExp(`^${project}:`) })
  await expect(row('Pivot').getByText('Sending', { exact: true })).toBeVisible()
  await expect(row('Pivot')).toContainText('12 of 58 sent, 0 failed, 1 skipped')
  await expect(row('Pivot').getByRole('meter')).toHaveAttribute('aria-valuenow', '13')
  await expect(row('Pivot').getByText(/^It's open, started [A-Z][a-z]{2} \d+, \d\d:\d\d UTC by n8watkins$/)).toBeVisible()
  await expect(row('KeysReady').getByText(/^Paused until .+, 00:00 UTC$/)).toBeVisible()
  await expect(row('KeysReady')).toContainText("Paused: today's 40 announcement emails are used")
  await expect(row('Solara').getByText('Done, 2 failed')).toBeVisible()
  await expect(row('Solara')).toContainText('24 of 26 sent, 2 failed')
  await expect(row('Solara').getByText(/^It launched, started .+, finished .+ UTC$/)).toBeVisible()
  await expect(row('Wren').getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(row('Wren').getByText(/, cancelled .+ UTC$/)).toBeVisible()
  for (const project of ['Pivot', 'KeysReady']) await expect(row(project).getByRole('button', { name: `Cancel the ${project} announcement` })).toBeVisible()
  for (const project of ['Solara', 'Wren']) await expect(row(project).getByRole('button')).toHaveCount(0)
  await expect(page.getByText('Updates every 5 seconds while sending.')).toBeVisible()
  expect(errors).toEqual([])
})

test('Compose: the picker, the budget, the project\'s own copy, checks by the field, live preview and a test to yourself', async ({ page }) => {
  const errors = await watchErrors(page)
  await page.goto('/announcements')
  await settle(page)
  await expect(page.getByRole('heading', { level: 2, name: 'New announcement' })).toBeVisible()

  // The 30-day rule and nobody to send to.
  await expect(projectRadio(page, 'KeysReady')).toBeDisabled()
  await expect(projectRadio(page, 'Pivot')).toBeDisabled()
  await expect(page.getByText(/^Announced [A-Z][a-z]{2} \d+; opens again [A-Z][a-z]{2} \d+$/).first()).toBeVisible()
  await expect(projectRadio(page, 'Asset Arsenal')).toBeDisabled()
  await expect(page.getByText('No one confirmed yet')).toBeVisible()
  // The biggest list that can be picked comes first, and is picked.
  await expect(projectRadio(page, 'Feelium')).toBeChecked()

  // The announcement budget, not the whole slice, and the warning that 214 runs past this month's.
  await expect(page.getByText(/^about \d+ left of 140$/)).toBeVisible()
  await expect(page.getByText(/About \d+ left of 40 today \(UTC\)\. Counted from this month's announcements; n8builds-web's whole slice/)).toBeVisible()
  const warning = page.getByRole('status').filter({ hasText: 'announcement emails left this month' })
  await expect(warning).toContainText('214 people is more than the')
  await expect(warning).toContainText('It sends about 40 a day')
  await expect(warning).toContainText('carries on next month')

  // n8builds-web fills the form in with Feelium's own copy, and renders it.
  await expect(field(page, 'Subject')).toHaveValue('Early access to Feelium is open')
  await expect(field(page, 'Button link')).toHaveValue('https://n8builds.dev/upcoming/feelium')
  await expect(field(page, 'Subject')).toHaveAttribute('aria-required', 'true')
  await expect(frame(page).getByRole('heading', { name: 'Feelium: early access is open' })).toBeVisible()
  await expect(page.locator('iframe[title="Email preview"]')).toHaveAttribute('sandbox', '')
  await expect(page.getByRole('definition').filter({ hasText: /^Early access to Feelium is open$/ })).toBeVisible()
  await expect(page.getByText('214 people on the Feelium waitlist')).toBeVisible()
  await expect(sendButton(page)).toBeEnabled()

  // It follows the typing, with a live count.
  await field(page, 'Title').fill('Feelium is open to all')
  await expect(page.getByText('22 / 80')).toBeVisible()
  await expect(frame(page).getByRole('heading', { name: 'Feelium is open to all' })).toBeVisible()

  // Over the limit, a required field emptied, a link that isn't https: said by the field, and nothing can go out.
  await field(page, 'Title').fill('x'.repeat(81))
  await expect(page.getByText('1 over the 80 characters.')).toBeVisible()
  await expect(field(page, 'Title')).toHaveAttribute('aria-invalid', 'true')
  await expect(sendButton(page)).toBeDisabled()
  await field(page, 'Title').fill('')
  await expect(page.getByText('Required.', { exact: true })).toBeVisible()
  await field(page, 'Title').fill('Feelium is open')
  await field(page, 'Button link').fill('http://n8builds.dev/upcoming/feelium')
  await expect(page.getByText('Must be a full link starting with https://.')).toBeVisible()
  await expect(sendButton(page)).toBeDisabled()
  await expect(page.getByText('Fix the fields marked in red to send it.')).toBeVisible()
  await field(page, 'Button link').fill('https://n8builds.dev/upcoming/feelium')
  await expect(sendButton(page)).toBeEnabled()

  await page.getByRole('button', { name: 'Send test to me' }).click()
  await expect(page.getByText('Test sent to your inbox.')).toBeVisible()

  // The progress update asks for your words: it previews with the placeholder, but won't send until it's replaced.
  await page.getByText('Progress update', { exact: true }).click()
  await expect(field(page, 'Subject')).toHaveValue('Feelium: a progress update')
  await expect(page.getByText('Replace the [[...]] placeholder with your own words.')).toBeVisible()
  await expect(frame(page).getByText('[[What changed, and what comes next]]')).toBeVisible()
  await expect(sendButton(page)).toBeDisabled()
  await field(page, 'Body').fill('You joined the waitlist for Feelium.\n\nThe week view is done; export comes next.')
  await expect(page.getByText('Replace the [[...]] placeholder with your own words.')).toHaveCount(0)
  await expect(sendButton(page)).toBeEnabled()

  // It launched has optional lines: empty is fine (left out), filled shows in the email.
  await page.getByText('It launched', { exact: true }).click()
  await expect(field(page, 'Early sign-up perk')).toHaveValue('')
  await expect(field(page, 'Early sign-up perk')).not.toHaveAttribute('aria-required', 'true')
  await expect(field(page, 'Self-host line')).toHaveValue('Rather self-host? It stays free and open source.')
  await expect(sendButton(page)).toBeEnabled()
  await field(page, 'Early sign-up perk').fill('Waitlist people get the first month free.')
  await expect(frame(page).getByText('Waitlist people get the first month free.')).toBeVisible()
  expect(errors).toEqual([])
})

test('Send: the dialog says who gets it and that it can\'t be unsent, then it shows under History', async ({ page }) => {
  await page.goto('/announcements')
  await settle(page)
  // Wren or, on a retry after Wren was sent, Solara.
  const name = (await projectRadio(page, 'Wren').isEnabled()) ? 'Wren' : 'Solara'
  const count = name === 'Wren' ? 41 : 26
  await projectRadio(page, name).check()
  await expect(field(page, 'Subject')).toHaveValue(`Early access to ${name} is open`)
  // It fits this month: a note on the pace, no warning.
  await expect(page.getByRole('status').filter({ hasText: 'announcement emails left this month' })).toHaveCount(0)
  await expect(frame(page).getByRole('heading', { name: `${name}: early access is open` })).toBeVisible()

  await sendButton(page).click()
  const dialog = page.getByRole('dialog', { name: `Send to ${count} people?` })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(`Everyone who confirmed the ${name} waitlist (${count} people) gets “Early access to ${name} is open” by email from n8builds.dev.`)
  await expect(dialog).toContainText('It can\'t be unsent.')
  // Backing out sends nothing.
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()

  await sendButton(page).click()
  await dialog.getByRole('button', { name: 'Send it' }).click()
  await expect(page).toHaveURL(/\/announcements\?tab=history$/)
  const row = page.getByRole('listitem', { name: `${name}: Early access to ${name} is open` })
  await expect(row).toBeVisible()
  await expect(row.getByText(/^It's open, started .+ by n8watkins$/)).toBeVisible()
  // The first batch goes out at once.
  await expect(row).toContainText(/(2\d|3\d|4\d) of \d+ sent/)

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
  await expect(dialog).toContainText('40 people already have it')
  await dialog.getByRole('button', { name: 'Stop sending' }).click()
  // The row turns cancelled (its Cancel, and the line by it, go with it), with the 139 not sent counted as skipped.
  await expect(row.getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(row).toContainText('40 of 180 sent, 1 failed, 139 skipped')
  await expect(row.getByText(/, cancelled .+ UTC$/)).toBeVisible()
  await expect(row.getByRole('button', { name: /^Cancel the/ })).toHaveCount(0)
})

test('the Overview tile shows the one going out', async ({ page }) => {
  await page.goto('/')
  await settle(page)
  const tile = page.getByTestId('tile-announcements')
  await expect(tile).toHaveAttribute('href', '/announcements')
  await expect(tile.getByRole('meter')).toBeVisible()
  await expect(tile).toContainText(/Sending: (Wren|Solara|Pivot)/)
})

for (const tab of ['', '?tab=history']) {
  test(`no axe violations (WCAG 2.1 AA) on ${tab || 'Compose'}`, async ({ page }) => {
    await page.goto(`/announcements${tab}`)
    await settle(page)
    if (!tab) await expect(frame(page).getByRole('heading').first()).toBeVisible()
    // The preview frame is left out: the email is n8builds-web's, and in a sandbox with no scripts axe can't run inside it (it hangs waiting for it).
    const results = await new AxeBuilder({ page }).exclude('iframe[title="Email preview"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([])
  })

  for (const width of [375, 320]) {
    test(`no sideways scroll at ${width}px on ${tab || 'Compose'}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto(`/announcements${tab}`)
      await settle(page)
      if (!tab) await expect(frame(page).getByRole('heading').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    })
  }
}
