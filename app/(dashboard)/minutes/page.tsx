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
      <PageHeader area={area} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel id="org" title="Appturnity org" className="lg:col-span-3">
          <Slot>
            <OrgMinutes />
          </Slot>
        </Panel>
        <Panel id="personal" title="Your personal account" className="lg:col-span-2">
          <Slot rows={3}>
            <PersonalMinutes />
          </Slot>
        </Panel>
      </div>
    </>
  )
}
