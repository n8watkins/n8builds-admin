import type { Metadata } from 'next'
import { AiCrawlersCard, TrafficPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { Tabs, currentTab } from '@/components/Tabs'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.traffic

export const metadata: Metadata = { title: area.label }

const TABS = [
  { id: 'visitors', label: 'Visitors' },
  { id: 'crawlers', label: 'AI crawlers' },
] as const

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  const tab = currentTab(TABS, (await searchParams).tab)
  return (
    <>
      <PageHeader area={area} />
      <div className="flex flex-col gap-5">
        <Tabs label="Website traffic sections" path={area.href} tabs={TABS} current={tab.id} />
        {tab.id === 'visitors' ? (
          <Panel id="traffic" title="The last 28 days">
            <Slot>
              <TrafficPanel />
            </Slot>
          </Panel>
        ) : (
          <Panel id="crawlers" title="AI crawlers">
            <AiCrawlersCard />
          </Panel>
        )}
      </div>
    </>
  )
}
