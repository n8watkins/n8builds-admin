import type { Metadata } from 'next'
import { SentryPanel } from '@/components/panels/connectors'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'Errors' }

export default async function ErrorsPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="Errors"
        description="Unresolved and new Sentry issues for n8builds.dev and the portfolio."
        source={{ label: 'Sentry', href: 'https://sentry.io' }}
      />
      <Panel id="sentry" title="Sentry" className="max-w-3xl">
        <Slot>
          <SentryPanel />
        </Slot>
      </Panel>
    </>
  )
}
