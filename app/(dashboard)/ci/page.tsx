import type { Metadata } from 'next'
import { CiStatus } from '@/components/panels/github'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'

export const metadata: Metadata = { title: 'CI' }

export default async function CiPage() {
  // The layout and the proxy check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        title="CI"
        description="The newest run of each workflow on every tracked repo's default branch, plus the latest run on any other branch."
        source={{ label: 'GitHub Actions', href: 'https://github.com/n8watkins' }}
      />
      <Panel id="ci" title="Workflows by repo">
        <Slot rows={9}>
          <CiStatus />
        </Slot>
      </Panel>
    </>
  )
}
