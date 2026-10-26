import { Header } from '@/components/Header'
import { requireOwner } from '@/lib/auth/owner'

// Reads the session cookie, so every request is checked (never prerendered).
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner()
  return (
    <>
      <Header owner={owner} />
      <main id="main" className="mx-auto max-w-[1360px] px-4 pt-6 pb-16 sm:px-8">
        {children}
      </main>
    </>
  )
}
