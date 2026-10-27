import { Fragment } from 'react'

/** Renders `backtick` spans in setup text as code. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, index) =>
        part.startsWith('`') && part.endsWith('`') && part.length > 1 ? (
          <code key={index} className="rounded bg-white/[0.06] px-1 py-px font-mono text-[0.85em] text-slate-200 [overflow-wrap:anywhere]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  )
}
