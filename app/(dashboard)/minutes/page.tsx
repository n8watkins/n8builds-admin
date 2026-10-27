import type { Metadata } from 'next'
import { OrgMinutes, PersonalMinutes } from '@/components/panels/github'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.minutes

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        area={area}
      />
      <div className="grid gap-6 xl:grid-cols-5">
        <Panel id="org" title="Appturnity org" description="Billed to the Appturnity organization. Its private monorepo-app uses these minutes." className="xl:col-span-3">
          <Slot>
            <OrgMinutes />
          </Slot>
        </Panel>
        <Panel id="personal" title="Your personal account" description="The n8watkins account. The n8builds repos are public, so they use none of it." className="xl:col-span-2">
          <Slot rows={3}>
            <PersonalMinutes />
          </Slot>
        </Panel>
      </div>
    </>
  )
}
