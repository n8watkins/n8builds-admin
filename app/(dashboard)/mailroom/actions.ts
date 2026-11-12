'use server'
import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/lib/auth/owner'
import type { ActionState } from '@/lib/action-state'
import { mailroomAdmin } from '@/lib/db'

/**
 * The Mailroom page's three changes. Each runs only for the signed-in owner,
 * after the confirmation dialog, and mailroom writes it to its audit log with
 * the owner's GitHub login as the actor.
 */
const APP_ID = /^[a-z0-9-]{1,40}$/

async function run(change: (admin: NonNullable<Awaited<ReturnType<typeof mailroomAdmin>>>, actor: string) => Promise<{ ok: true; detail: string } | { ok: false; error: string }>): Promise<ActionState> {
  const owner = await requireOwner()
  const admin = await mailroomAdmin()
  if (!admin) return { ok: false, message: 'mailroom is not bound to this server.' }
  try {
    const result = await change(admin, owner.login)
    revalidatePath('/mailroom')
    return result.ok ? { ok: true, message: result.detail } : { ok: false, message: result.error }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'mailroom did not answer.' }
  }
}

export async function removeSuppression(_state: ActionState, formData: FormData): Promise<ActionState> {
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: 'Unknown suppression.' }
  return run((admin, actor) => admin.removeSuppression(id, actor))
}

export async function setPaused(_state: ActionState, formData: FormData): Promise<ActionState> {
  const app = String(formData.get('app') ?? '')
  const paused = formData.get('paused') === 'true'
  if (!APP_ID.test(app)) return { ok: false, message: 'Unknown app.' }
  return run((admin, actor) => admin.setPaused(app, paused, actor))
}

export async function setDailyCap(_state: ActionState, formData: FormData): Promise<ActionState> {
  const app = String(formData.get('app') ?? '')
  if (!APP_ID.test(app)) return { ok: false, message: 'Unknown app.' }
  const raw = String(formData.get('cap') ?? '').trim()
  const cap = raw === '' || formData.get('reset') === 'true' ? null : Number(raw)
  if (cap !== null && (!Number.isInteger(cap) || cap < 0)) return { ok: false, message: 'The daily cap must be a whole number.' }
  return run((admin, actor) => admin.setDailyCap(app, cap, actor))
}
