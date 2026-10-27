import { Suspense, type ReactNode } from 'react'
import { PanelBoundary } from './PanelBoundary'
import { PanelSkeleton } from './ui'

/** One panel body: its own Suspense boundary (streams in when its data arrives) and its own error boundary. */
export function Slot({ children, rows }: { children: ReactNode; rows?: number }) {
  return (
    <PanelBoundary>
      <Suspense fallback={<PanelSkeleton rows={rows} />}>{children}</Suspense>
    </PanelBoundary>
  )
}
