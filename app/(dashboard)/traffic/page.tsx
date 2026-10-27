import type { Metadata } from 'next'
import { AiCrawlersCard, TrafficPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Website traffic' }

export default async function TrafficPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Website traffic"
        description="Visitors, pages, referrers and engagement on n8builds.dev from Google Analytics, and where to see AI crawlers."
        source={{ label: 'Google Analytics', href: 'https://analytics.google.com/analytics/web/' }}
      />
      <div className="space-y-6">
        <Panel id="traffic" title="Last 28 days">
          <Slot>
            <TrafficPanel />
          </Slot>
        </Panel>
        <Panel id="crawlers" title="AI crawlers" className="max-w-3xl">
          <AiCrawlersCard />
        </Panel>
      </div>
    </>
  )
}
