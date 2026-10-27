import { MobileNav, Sidebar } from '@/components/Nav'
import { requireOwner } from '@/lib/auth/owner'
import { OUTBOUND_LINKS } from '@/lib/links'
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
    outbound: OUTBOUND_LINKS,
  }
  return (
    <>
      <Sidebar {...nav} />
      <MobileNav {...nav} />
      <main id="main" className="lg:pl-64">
        <div className="mx-auto max-w-[1120px] px-4 pt-8 pb-20 sm:px-8 lg:px-12 lg:pt-12">{children}</div>
      </main>
    </>
  )
}
