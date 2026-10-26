import type { ReactNode } from 'react'
import { AlertIcon, ExternalIcon, KeyIcon, PlugIcon } from './icons'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** A dashboard card. The header renders at once; the body streams in its own Suspense boundary. */
export function Panel({
  id,
  index,
  title,
  source,
  extra,
  className,
  children,
}: {
  id: string
  /** "01": the owner's panel order. */
  index?: string
  title: string
  source?: { label: string; href: string }
  /** Marks a card beyond the agreed MVP. */
  extra?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cx('flex min-w-0 flex-col rounded-2xl border bg-panel/80 p-5 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset]', className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {index && <span className="font-mono text-[11px] font-semibold text-cyan-400/80">{index}</span>}
          <h2 id={`${id}-title`} className="truncate text-[15px] font-semibold text-slate-100">
            {title}
          </h2>
          {extra && (
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/5 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-cyan-300 uppercase">
              Extra
            </span>
          )}
        </div>
        {source && (
          <a
            href={source.href}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1 text-xs text-slate-450 transition-colors hover:text-cyan-300">
            {source.label}
            <ExternalIcon className="size-3" />
          </a>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

export function SectionHeading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="col-span-full mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 first:mt-0">
      <h2 className="text-xs font-semibold tracking-[0.14em] text-slate-450 uppercase">{title}</h2>
      {note && <p className="text-xs text-slate-475">{note}</p>}
    </div>
  )
}

export type Tone = 'good' | 'bad' | 'warn' | 'idle' | 'running'

const DOT: Record<Tone, string> = {
  good: 'bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.55)]',
  bad: 'bg-rose-400 shadow-[0_0_8px_rgb(251_113_133/0.55)]',
  warn: 'bg-amber-300 shadow-[0_0_8px_rgb(252_211_77/0.45)]',
  idle: 'bg-slate-500',
  running: 'bg-cyan-400 shadow-[0_0_8px_rgb(34_211_238/0.6)] animate-pulse',
}

export function Dot({ tone, label }: { tone: Tone; label?: string }) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cx('inline-block size-2 shrink-0 rounded-full', DOT[tone])} />
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium tracking-wide text-slate-450 uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-50 tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-450">{hint}</p>}
    </div>
  )
}

/** A horizontal meter, e.g. minutes used of the free 2,000. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const share = Math.min(1, max > 0 ? value / max : 0)
  const tone = share >= 0.9 ? 'bg-rose-400' : share >= 0.7 ? 'bg-amber-300' : 'bg-cyan-400'
  return (
    <div role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={cx('h-full rounded-full', tone)} style={{ width: `${Math.max(share * 100, value > 0 ? 1.5 : 0)}%` }} />
    </div>
  )
}

/** A ranked list with proportional bars (top pages, per-repo minutes). */
export function BarList({ rows, format = String }: { rows: { label: string; value: number; href?: string }[]; format?: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-1 text-[13px]">
          <span aria-hidden className="absolute inset-y-0 left-0 rounded-md bg-cyan-400/[0.09]" style={{ width: `${(row.value / max) * 100}%` }} />
          <span className="relative truncate text-slate-200">{row.label}</span>
          <span className="relative shrink-0 font-mono text-xs text-slate-300 tabular-nums">{format(row.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The card a panel shows until its account resource exists: what it needs
 * (env var names only, never values), what it will show, and the plan.
 */
export function NotConnected({
  kind = 'not-connected',
  title,
  why,
  needs,
  willShow,
  plan,
  setupStep,
}: {
  kind?: 'not-connected' | 'needs-permission'
  title?: string
  why: ReactNode
  needs?: string[]
  willShow?: string[]
  plan?: ReactNode[]
  /** The matching section of docs/SETUP.md. */
  setupStep?: string
}) {
  const permission = kind === 'needs-permission'
  return (
    <div className={cx('flex flex-1 flex-col gap-3 rounded-xl border border-dashed p-4', permission ? 'border-amber-300/25 bg-amber-300/[0.03]' : 'border-white/10 bg-white/[0.015]')}>
      <p className={cx('flex items-center gap-2 text-sm font-semibold', permission ? 'text-amber-200' : 'text-slate-200')}>
        {permission ? <KeyIcon /> : <PlugIcon className="size-4 text-cyan-400" />}
        {title ?? (permission ? 'Needs a token permission' : 'Not connected yet')}
      </p>
      <p className="text-[13px] leading-relaxed text-slate-400">{why}</p>
      {willShow && willShow.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-slate-475 uppercase">Will show</p>
          <ul className="flex flex-wrap gap-1.5">
            {willShow.map((item) => (
              <li key={item} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-xs text-slate-300">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan && plan.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-slate-475 uppercase">Plan</p>
          <ol className="list-decimal space-y-1 pl-4 text-[13px] leading-relaxed text-slate-400 marker:text-slate-500">
            {plan.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      {(needs?.length || setupStep) && (
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {needs?.map((name) => (
            <code key={name} className="rounded border border-white/10 bg-darkBlue px-1.5 py-0.5 font-mono text-[11px] text-cyan-200/90">
              {name}
            </code>
          ))}
          {setupStep && <span className="ml-auto text-[11px] text-slate-475">docs/SETUP.md, {setupStep}</span>}
        </div>
      )}
    </div>
  )
}

export function PanelError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-4 text-[13px] text-rose-200">
      <AlertIcon className="mt-0.5 size-4 text-rose-300" />
      <p>
        <span className="font-semibold">Couldn&apos;t load this panel.</span> <span className="text-rose-200/80">{message}</span>
      </p>
    </div>
  )
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-2.5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-7 animate-pulse rounded-md bg-white/[0.04]" style={{ width: `${92 - index * 9}%` }} />
      ))}
    </div>
  )
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}
