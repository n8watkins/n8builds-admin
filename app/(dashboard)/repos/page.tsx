import type { Metadata } from 'next'
import { RepoStats } from '@/components/panels/github'
import { TrendsPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Stars and traffic' }

export default async function ReposPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Stars and traffic"
        description="Stars, and views and clones over the last 14 days, for every public repo behind a build. Trends come from the daily snapshot."
        source={{ label: 'Repositories', href: 'https://github.com/n8watkins?tab=repositories' }}
      />
      <div className="space-y-6">
        <Panel id="repos" title="By repo">
          <Slot rows={9}>
            <RepoStats />
          </Slot>
        </Panel>
        <Panel id="trends" title="Stars and minutes over time">
          <Slot>
            <TrendsPanel />
          </Slot>
        </Panel>
      </div>
    </>
  )
}
