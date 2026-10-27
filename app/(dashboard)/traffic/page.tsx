import type { Metadata } from 'next'
import { AiCrawlersCard, TrafficPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.traffic

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
        <Panel id="traffic" title="The last 28 days" description="From Google Analytics, for all of n8builds.dev.">
          <Slot>
            <TrafficPanel />
          </Slot>
        </Panel>
        <Panel id="crawlers" title="AI crawlers" description="Bots that read the site for AI models, logged by Vercel.">
          <AiCrawlersCard />
        </Panel>
      </div>
    </>
  )
}
