import type { Metadata } from 'next'
import { ContactPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Contact messages' }

export default async function ContactPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Contact messages"
        description="How many messages arrived through n8builds.dev's contact form."
      />
      <Panel id="contact" title="Messages" className="max-w-3xl">
        <Slot>
          <ContactPanel />
        </Slot>
      </Panel>
    </>
  )
}
