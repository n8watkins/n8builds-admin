'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Re-reads the page every few seconds while `active` (an announcement is sending), and stops once it isn't. */
export function AutoRefresh({ active, seconds = 5 }: { active: boolean; seconds?: number }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => {
      // A hidden tab waits until it is looked at again.
      if (document.visibilityState === 'visible') router.refresh()
    }, seconds * 1000)
    return () => clearInterval(timer)
  }, [active, seconds, router])
  if (!active) return null
  return <p className="text-[13px] text-slate-400">Updates every {seconds} seconds while sending.</p>
}
