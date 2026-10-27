import { MobileNav, Sidebar } from '@/components/Nav'
import { requireOwner } from '@/lib/auth/owner'
import { allSetupStatuses } from '@/lib/setup-status'

// Reads the session cookie, so every request is checked (never prerendered).
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner()
  const setup = await allSetupStatuses()
  const nav = {
    login: owner.login,
    devBypass: owner.devBypass,
    setupLeft: setup.filter(({ status }) => status.state === 'missing' || status.state === 'partial').length,
  }
  return (
    <>
      <Sidebar {...nav} />
      <MobileNav {...nav} />
      <main id="main" className="lg:pl-72">
        <div className="mx-auto max-w-[1180px] px-4 pt-8 pb-24 sm:px-8 lg:px-14 lg:pt-14">{children}</div>
      </main>
    </>
  )
}
