import type { Metadata } from 'next'
import { LatestDeploys, LatestReleases, MonthActivity } from '@/components/panels/extras'
import { Slot } from '@/components/Slot'
import { ExternalAction, PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.releases

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        area={area}
        actions={<ExternalAction href="https://vercel.com/natkins23s-projects">Open Vercel</ExternalAction>}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel id="deploys" title="Latest deploys" description="Newest first, across every repo that deploys to Vercel.">
          <Slot rows={6}>
            <LatestDeploys />
          </Slot>
        </Panel>
        <div className="space-y-6">
          <Panel id="releases" title="Latest releases" description="The newest tagged version of each build.">
            <Slot rows={4}>
              <LatestReleases />
            </Slot>
          </Panel>
          <Panel id="activity" title="This month" description="How much shipped: commits on main branches and releases.">
            <Slot>
              <MonthActivity />
            </Slot>
          </Panel>
        </div>
      </div>
    </>
  )
}
