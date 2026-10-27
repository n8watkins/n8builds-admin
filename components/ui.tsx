import Link from 'next/link'
import type { ReactNode } from 'react'
import { AlertIcon, ExternalIcon, KeyIcon, PlugIcon } from './icons'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** A card: the same quiet surface everywhere, no border. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-white/[0.025] p-5 sm:p-6', className)}>{children}</div>
}

/** A titled card on a detail page. Its body streams in its own Suspense boundary. */
export function Panel({
  id,
  title,
  source,
  className,
  children,
}: {
  id: string
  title: string
  source?: { label: string; href: string }
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cx('flex min-w-0 flex-col rounded-2xl bg-white/[0.025] p-5 sm:p-6', className)}>
      <header className="mb-5 flex items-baseline justify-between gap-3">
        <h2 id={`${id}-title`} className="text-[15px] font-semibold text-slate-100">
          {title}
        </h2>
        {source && <SourceLink {...source} />}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

export function SourceLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs text-slate-450 transition-colors hover:text-cyan-300">
      {label}
      <ExternalIcon className="size-3" />
    </a>
  )
}

/** A detail page's heading. */
export function PageHeader({ title, description, source }: { title: string; description?: ReactNode; source?: { label: string; href: string } }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h1>
        {description && <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{description}</p>}
      </div>
      {source && <SourceLink {...source} />}
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
 * What a page shows until its account resource exists: what it needs
 * (env var names only, never values), what it will show, the plan, and a
 * link to the matching Setup item.
 */
export function NotConnected({
  kind = 'not-connected',
  title,
  why,
  needs,
  willShow,
  plan,
  setupId,
}: {
  kind?: 'not-connected' | 'needs-permission'
  title?: string
  why: ReactNode
  needs?: string[]
  willShow?: string[]
  plan?: ReactNode[]
  /** The Setup item that connects it. */
  setupId?: string
}) {
  const permission = kind === 'needs-permission'
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div>
        <p className={cx('flex items-center gap-2 text-sm font-semibold', permission ? 'text-amber-200' : 'text-slate-200')}>
          {permission ? <KeyIcon /> : <PlugIcon className="size-4 text-slate-450" />}
          {title ?? (permission ? 'Needs a token permission' : 'Not connected yet')}
        </p>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-400">{why}</p>
      </div>
      {willShow && willShow.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-slate-475 uppercase">Will show</p>
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
          <p className="mb-2 text-[11px] font-medium tracking-wide text-slate-475 uppercase">Plan</p>
          <ol className="max-w-2xl list-decimal space-y-1.5 pl-4 text-[14px] leading-relaxed text-slate-400 marker:text-slate-500">
            {plan.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      {(needs?.length || setupId) && (
        <div className="mt-auto flex flex-wrap items-center gap-2">
          {needs?.map((name) => (
            <code key={name} className="rounded bg-darkBlue px-1.5 py-0.5 font-mono text-[11px] text-cyan-200/90">
              {name}
            </code>
          ))}
          {setupId && (
            <Link href={`/setup#${setupId}`} className="ml-auto text-[13px] font-medium text-cyan-300 hover:text-cyan-200">
              How to connect it →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export function PanelError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-400/[0.05] p-4 text-[13px] text-rose-200">
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
