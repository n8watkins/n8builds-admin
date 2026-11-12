'use server'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'
import { formatDay } from '@/lib/announce-view'
import { announceAdmin, type AnnounceAdmin, type AnnounceInput, type AnnouncePreview, type TemplateId } from '@/lib/announcements'
import { requireOwner } from '@/lib/auth/owner'

/**
 * The Announcements page's calls to n8builds-web. Each runs only for the
 * signed-in owner, passes the owner's GitHub login as the actor, and checks
 * its input against n8builds-web's own templates before anything is sent.
 */

const SLUG = /^[a-z0-9-]{1,60}$/
const ID = /^[A-Za-z0-9_-]{1,64}$/
const TEMPLATES: readonly TemplateId[] = ['open', 'progress', 'launched']

type Checked = { ok: true; admin: AnnounceAdmin; input: AnnounceInput } | { ok: false; message: string }

const failure = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)

/** The project, template and fields, known to n8builds-web, every field filled in and within its limit. */
async function check(raw: { project: unknown; template: unknown; fields: unknown }): Promise<Checked> {
  const project = String(raw.project ?? '')
  const template = String(raw.template ?? '') as TemplateId
  if (!SLUG.test(project)) return { ok: false, message: 'Pick a project.' }
  if (!TEMPLATES.includes(template)) return { ok: false, message: 'Pick a template.' }
  const fields = typeof raw.fields === 'string' ? safeJson(raw.fields) : raw.fields
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return { ok: false, message: 'The fields could not be read.' }
  const admin = await announceAdmin()
  if (!admin) return { ok: false, message: 'n8builds-web is not connected to this server.' }
  let known
  try {
    known = (await admin.templates()).find((t) => t.id === template)
  } catch (error) {
    return { ok: false, message: failure(error, 'n8builds-web did not answer.') }
  }
  if (!known) return { ok: false, message: 'n8builds-web has no such template.' }
  const values: Record<string, string> = {}
  for (const field of known.fields) {
    const value = (fields as Record<string, unknown>)[field.key]
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) return { ok: false, message: `${field.label} is empty.` }
    if ([...text].length > field.max) return { ok: false, message: `${field.label} is longer than ${field.max} characters.` }
    values[field.key] = text
  }
  return { ok: true, admin, input: { project, template, fields: values } }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const fromForm = (formData: FormData) => ({ project: formData.get('project'), template: formData.get('template'), fields: formData.get('fields') })

/** The email as it will go out, for the live preview. */
export async function previewAnnouncement(raw: { project: string; template: string; fields: Record<string, string> }): Promise<{ ok: true; preview: AnnouncePreview } | { ok: false; message: string }> {
  await requireOwner()
  const checked = await check(raw)
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
  const checked = await check(fromForm(formData))
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
  const checked = await check(fromForm(formData))
  if (!checked.ok) return checked
  try {
    const result = await checked.admin.start(checked.input, owner.login)
    if ('error' in result) {
      return { ok: false, message: `Too soon: this project can be announced again on ${formatDay(result.nextAllowedAt, Date.now())}.` }
    }
    revalidatePath('/announcements')
    revalidatePath('/')
    return { ok: true, message: 'Started: it is going out now.' }
  } catch (error) {
    return { ok: false, message: failure(error, 'n8builds-web did not answer.') }
  }
}

/** Stops the emails not sent yet. */
export async function cancelAnnouncement(_state: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const raw = String(formData.get('id') ?? '')
  if (!ID.test(raw)) return { ok: false, message: 'Unknown announcement.' }
  // The id goes back as n8builds-web gave it: a number stays a number.
  const id = formData.get('numeric') === 'true' && /^\d+$/.test(raw) ? Number(raw) : raw
  const admin = await announceAdmin()
  if (!admin) return { ok: false, message: 'n8builds-web is not connected to this server.' }
  try {
    const result = (await admin.cancel(id, owner.login)) as { ok?: boolean; error?: string; code?: string } | undefined
    if (result && result.ok === false) return { ok: false, message: result.error ?? result.code ?? 'n8builds-web did not cancel it.' }
    revalidatePath('/announcements')
    revalidatePath('/')
    return { ok: true, message: 'Cancelled: nothing more goes out.' }
  } catch (error) {
    return { ok: false, message: failure(error, 'n8builds-web did not answer.') }
  }
}
