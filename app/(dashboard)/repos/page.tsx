import type { Metadata } from 'next'
import { TrendsPanel } from '@/components/panels/connectors'
import { RepoStats } from '@/components/panels/github'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.repos

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        area={area}
      />
      <div className="space-y-6">
        <Panel id="repos" title="By repo" description="Stars today, and views and clones over the last 14 days.">
          <Slot rows={9}>
            <RepoStats />
          </Slot>
        </Panel>
        <Panel id="trends" title="Over time" description="Stars and minutes from the daily snapshot.">
          <Slot>
            <TrendsPanel />
          </Slot>
        </Panel>
      </div>
    </>
  )
}
