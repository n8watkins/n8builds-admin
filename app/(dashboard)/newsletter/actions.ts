'use server'
import { revalidatePath } from 'next/cache'
import type { ActionState } from '@/lib/action-state'
import { requireOwner } from '@/lib/auth/owner'
import { newsletterAdmin } from '@/lib/newsletter'

/**
 * "Turn newsletter on/off": runs only for the signed-in owner, after the
 * confirmation dialog; n8builds-web stores it and logs the owner's GitHub
 * login with the change.
 */
export async function setNewsletter(_state: ActionState, formData: FormData): Promise<ActionState> {
  const owner = await requireOwner()
  const value = formData.get('on')
  if (value !== 'true' && value !== 'false') return { ok: false, message: 'Unknown setting.' }
  const on = value === 'true'
  const admin = await newsletterAdmin()
  if (!admin) return { ok: false, message: 'n8builds-web is not connected to this server.' }
  try {
    // The page disables "Turn newsletter on" without the Kit key; refuse it here too.
    if (on && !(await admin.status()).kit.configured) return { ok: false, message: 'Set the Kit key on n8builds-web first.' }
    await admin.setSwitch(on, owner.login)
    revalidatePath('/newsletter')
    revalidatePath('/')
    return { ok: true, message: on ? 'The newsletter is on.' : 'The newsletter is off.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'n8builds-web did not answer.' }
  }
}
