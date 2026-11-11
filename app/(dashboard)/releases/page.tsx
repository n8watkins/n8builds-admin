import type { Metadata } from 'next'
import { MonthActivity } from '@/components/panels/extras'
import { PreviewDeploys, ProjectReleases } from '@/components/panels/releases'
import { Slot } from '@/components/Slot'
import { Tabs, currentTab } from '@/components/Tabs'
import { ExternalAction, PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { CLOUDFLARE_ACCOUNT } from '@/lib/repos'

const area = AREAS.releases

export const metadata: Metadata = { title: area.label }

const TABS = [
  { id: 'latest', label: 'Latest' },
  { id: 'month', label: 'This month' },
  { id: 'previews', label: 'Previews' },
] as const

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  const tab = currentTab(TABS, (await searchParams).tab)
  return (
    <>
      <PageHeader
        area={area}
        actions={<ExternalAction href={`https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT}/workers-and-pages`} describe="Open your Cloudflare Workers">Cloudflare</ExternalAction>}
      />
      <div className="flex flex-col gap-5">
        <Tabs label="Releases and deploys sections" path={area.href} tabs={TABS} current={tab.id} />
        {tab.id === 'latest' && (
          <Panel id="projects" title="Latest by project">
            <Slot rows={9}>
              <ProjectReleases />
            </Slot>
          </Panel>
        )}
        {tab.id === 'month' && (
          <Panel id="activity" title="This month">
            <Slot>
              <MonthActivity />
            </Slot>
          </Panel>
        )}
        {tab.id === 'previews' && (
          <Panel id="previews" title="Preview deploys">
            <Slot rows={2}>
              <PreviewDeploys />
            </Slot>
          </Panel>
        )}
      </div>
    </>
  )
}
