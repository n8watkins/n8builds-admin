import type { Metadata } from 'next'
import { ContactPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.contact

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        area={area}
      />
      <Panel id="contact" title="Messages" description="Delivered messages per day.">
        <Slot>
          <ContactPanel />
        </Slot>
      </Panel>
    </>
  )
}
