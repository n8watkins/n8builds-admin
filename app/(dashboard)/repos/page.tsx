import type { Metadata } from 'next'
import { TrendsPanel } from '@/components/panels/connectors'
import { RepoStats } from '@/components/panels/github'
import { Slot } from '@/components/Slot'
import { Tabs, currentTab } from '@/components/Tabs'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.repos

export const metadata: Metadata = { title: area.label }

const TABS = [
  { id: 'repos', label: 'By repo' },
  { id: 'trends', label: 'Over time' },
] as const

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  const tab = currentTab(TABS, (await searchParams).tab)
  return (
    <>
      <PageHeader area={area} />
      <div className="flex flex-col gap-5">
        <Tabs label="Stars and traffic sections" path={area.href} tabs={TABS} current={tab.id} />
        {tab.id === 'repos' ? (
          <Panel id="repos" title="By repo" description="Stars today; views and clones over the last 14 days.">
            <Slot rows={9}>
              <RepoStats />
            </Slot>
          </Panel>
        ) : (
          <Panel id="trends" title="Over time">
            <Slot>
              <TrendsPanel />
            </Slot>
          </Panel>
        )}
      </div>
    </>
  )
}
