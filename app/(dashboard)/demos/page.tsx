import type { Metadata } from 'next'
import { DemoStatus } from '@/components/panels/extras'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.demos

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader area={area} />
      <Panel id="demos" title="The last 30 days" description="One bar per day: green up, amber slow, red down, grey scheduled off.">
        <Slot rows={3}>
          <DemoStatus />
        </Slot>
      </Panel>
    </>
  )
}
