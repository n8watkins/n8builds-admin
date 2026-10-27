import type { Metadata } from 'next'
import { LatestDeploys, LatestReleases, MonthActivity } from '@/components/panels/extras'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Releases and deploys' }

export default async function ReleasesPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Releases and deploys"
        description="The latest release of each repo, the newest deployments, and how much shipped this month."
        source={{ label: 'Vercel', href: 'https://vercel.com/natkins23s-projects' }}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="deploys" title="Latest deploys">
          <Slot rows={6}>
            <LatestDeploys />
          </Slot>
        </Panel>
        <div className="space-y-6">
          <Panel id="releases" title="Latest releases">
            <Slot rows={4}>
              <LatestReleases />
            </Slot>
          </Panel>
          <Panel id="activity" title="This month" source={{ label: 'Build log', href: 'https://n8builds.dev/builds' }}>
            <Slot>
              <MonthActivity />
            </Slot>
          </Panel>
        </div>
      </div>
    </>
  )
}
