import type { Metadata } from 'next'
import { GamePanel } from '@/components/panels/game'
import { Slot } from '@/components/Slot'
import { PageHeader, Panel } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'

const area = AREAS.game

export const metadata: Metadata = { title: area.label }

export default async function Page() {
  // The proxy and the layout check too; every page checks on its own as well.
  await requireOwner()
  return (
    <>
      <PageHeader area={area} />
      <Panel id="game" title="The catch game" description="Rounds, players and scores from n8builds.dev and the portfolio.">
        <Slot>
          <GamePanel />
        </Slot>
      </Panel>
    </>
  )
}
