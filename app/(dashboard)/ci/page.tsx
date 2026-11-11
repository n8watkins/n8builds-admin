import type { Metadata } from 'next'
import { LuGithub } from 'react-icons/lu'
import { CiStatus } from '@/components/panels/github'
import { Slot } from '@/components/Slot'
import { ExternalAction, PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.ci

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        area={area}
        actions={
          <ExternalAction href="https://github.com/n8watkins?tab=repositories" icon={LuGithub} describe="Your repos on GitHub">
            Repos
          </ExternalAction>
        }
      />
      <Panel id="ci" title="Workflows by repo">
        <Slot rows={9}>
          <CiStatus />
        </Slot>
      </Panel>
    </>
  )
}
