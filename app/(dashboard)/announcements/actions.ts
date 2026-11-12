'use server'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'
import { fieldChecks, formatDay, formatPeople, PLACEHOLDER } from '@/lib/announce-view'
import { announceAdmin, type AnnounceAdmin, type AnnounceInput, type AnnouncePreview, type TemplateId } from '@/lib/announcements'
import { requireOwner } from '@/lib/auth/owner'

/**
 * The Announcements page's calls to n8builds-web. Each runs only for the
 * signed-in owner, passes the owner's GitHub login as the actor, and checks
 * its input against n8builds-web's own templates first, the way n8builds-web
 * checks it (lib/announce-view.ts fieldChecks), so a mistake shows by the
 * form instead of as a refusal.
 */

const SLUG = /^[a-z0-9-]{1,60}$/
/** n8builds-web's announcement ids: 32 hex characters. */
const ID = /^[a-f0-9]{32}$/
const TEMPLATES: readonly TemplateId[] = ['open', 'progress', 'launched']

type Checked = { ok: true; admin: AnnounceAdmin; input: AnnounceInput } | { ok: false; message: string }

/** n8builds-web's own words for a refusal (it throws on bad input), or a fallback. */
const failure = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * The project, the template and its fields, every one known to n8builds-web.
 * With `defaults`, no fields at all (n8builds-web fills in the project's own
 * copy); otherwise every field of the template, each checked as n8builds-web
 * checks it, and, to start, with no [[...]] placeholder left in.
 */
async function check(raw: { project: unknown; template: unknown; fields: unknown }, mode: 'defaults' | 'preview' | 'send'): Promise<Checked> {
  const project = String(raw.project ?? '')
  const template = String(raw.template ?? '') as TemplateId
  if (!SLUG.test(project)) return { ok: false, message: 'Pick a project.' }
  if (!TEMPLATES.includes(template)) return { ok: false, message: 'Pick a template.' }
  const admin = await announceAdmin()
  if (!admin) return { ok: false, message: 'n8builds-web is not connected to this server.' }
  if (mode === 'defaults') return { ok: true, admin, input: { project, template, fields: {} } }

  const fields = typeof raw.fields === 'string' ? safeJson(raw.fields) : raw.fields
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return { ok: false, message: 'The fields could not be read.' }
  let known
  try {
    known = (await admin.templates()).find((t) => t.id === template)
  } catch (error) {
    return { ok: false, message: failure(error, 'n8builds-web did not answer.') }
  }
  if (!known) return { ok: false, message: 'n8builds-web has no such template.' }
  const given = fields as Record<string, unknown>
  // Every key of the template goes over, an empty optional one too: empty turns its line off, where a missing one would bring the default back.
  const values = Object.fromEntries(known.fields.map((field) => [field.key, typeof given[field.key] === 'string' ? (given[field.key] as string).trim() : '']))
  for (const [index, result] of fieldChecks(known, values).entries()) {
    if (!result.error || (mode === 'preview' && PLACEHOLDER.test(values[result.key]))) continue
    return { ok: false, message: `${known.fields[index].label}: ${result.error}` }
  }
  return { ok: true, admin, input: { project, template, fields: values } }
}

const fromForm = (formData: FormData) => ({ project: formData.get('project'), template: formData.get('template'), fields: formData.get('fields') })

/**
 * The email as it will go out, for the live preview. With `defaults`, the
 * project's own copy for the template, to fill the form in (its `fields`).
 */
export async function previewAnnouncement(
  raw: { project: string; template: string; fields: Record<string, string> },
  { defaults = false }: { defaults?: boolean } = {},
): Promise<{ ok: true; preview: AnnouncePreview } | { ok: false; message: string }> {
  await requireOwner()
  const checked = await check(raw, defaults ? 'defaults' : 'preview')
  if (!checked.ok) return checked
  try {
    return { ok: true, preview: await checked.admin.preview(checked.input) }
  } catch (error) {
    return { ok: false, message: failure(error, 'n8builds-web could not render it.') }
  }
}

/** One copy to the owner's own inbox. */
export async function sendTestAnnouncement(_state: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const checked = await check(fromForm(formData), 'preview')
  if (!checked.ok) return checked
  try {
    const result = await checked.admin.sendTest(checked.input, owner.login)
    if (result.ok) return { ok: true, message: 'Test sent to your inbox.' }
    const code = result.code ? result.code.replaceAll('_', ' ') : 'mailroom refused it'
    return { ok: false, message: `Not sent: ${code}${result.retryable ? '. Try again in a moment.' : '.'}` }
  } catch (error) {
    return { ok: false, message: failure(error, 'n8builds-web did not answer.') }
  }
}

/** Starts sending to everyone confirmed on the project's waitlist. */
export async function startAnnouncement(_state: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const checked = await check(fromForm(formData), 'send')
  if (!checked.ok) return checked
  try {
    const result = await checked.admin.start(checked.input, owner.login)
    if ('error' in result) {
      if (result.error === 'no_recipients') return { ok: false, message: 'Not sent: no one is confirmed on this project\'s waitlist any more.' }
      return { ok: false, message: `Not sent: this project can be announced again on ${formatDay(result.nextAllowedAt, Date.now())}.` }
    }
    revalidatePath('/announcements')
    revalidatePath('/')
    return { ok: true, message: 'Started: the first emails are going out now.' }
  } catch (error) {
    return { ok: false, message: `Not sent: ${failure(error, 'n8builds-web did not answer.')}` }
  }
}

/** Stops the emails not sent yet. */
export async function cancelAnnouncement(_state: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const id = String(formData.get('id') ?? '')
  if (!ID.test(id)) return { ok: false, message: 'Unknown announcement.' }
  const admin = await announceAdmin()
  if (!admin) return { ok: false, message: 'n8builds-web is not connected to this server.' }
  try {
    const after = await admin.cancel(id, owner.login)
    if (!after) return { ok: false, message: 'n8builds-web has no such announcement.' }
    revalidatePath('/announcements')
    revalidatePath('/')
    if (after.state !== 'cancelled') return { ok: false, message: `It had already ${after.state === 'done' ? 'finished' : 'stopped'}: nothing changed.` }
    return { ok: true, message: `Cancelled: ${formatPeople(after.sent)} had it, ${formatPeople(after.skipped)} won't get it.` }
  } catch (error) {
    return { ok: false, message: failure(error, 'n8builds-web did not answer.') }
  }
}
