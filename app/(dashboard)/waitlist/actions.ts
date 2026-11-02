'use server'
import { revalidatePath } from 'next/cache'
import { requireOwner } from '@/lib/auth/owner'
import { deleteEntry } from '@/lib/waitlist'

/** Deletes one sign-up (someone asked to be removed by email). */
export async function deleteSignup(formData: FormData) {
  await requireOwner()
  const id = formData.get('id')
  if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) return
  await deleteEntry(id)
  revalidatePath('/waitlist')
}
