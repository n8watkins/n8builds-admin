import type { Metadata } from 'next'
import { MonthActivity } from '@/components/panels/extras'
import { PreviewDeploys, ProjectReleases } from '@/components/panels/releases'
import { Slot } from '@/components/Slot'
import { ExternalAction, PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.releases

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader
        area={area}
        actions={<ExternalAction href="https://vercel.com/natkins23s-projects" describe="Open your Vercel projects">Vercel</ExternalAction>}
      />
      <div className="space-y-6">
        <Panel id="projects" title="By project" description="Each build's latest release and what it changed, what has landed since, and its production deploy.">
          <Slot rows={9}>
            <ProjectReleases />
          </Slot>
        </Panel>
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel id="activity" title="This month" description="How much shipped: commits on main branches and releases.">
            <Slot>
              <MonthActivity />
            </Slot>
          </Panel>
          <Panel id="previews" title="Preview deploys" description="Vercel builds a preview of each pull request. Folded away unless one failed.">
            <Slot rows={2}>
              <PreviewDeploys />
            </Slot>
          </Panel>
        </div>
      </div>
    </>
  )
}
