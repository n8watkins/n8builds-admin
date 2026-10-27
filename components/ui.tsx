import Link from 'next/link'
import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { LuArrowRight, LuChevronDown, LuGithub, LuCircleAlert, LuCircleCheck, LuCircleDashed, LuExternalLink, LuInfo, LuKeyRound, LuPlug, LuTriangleAlert } from 'react-icons/lu'
import type { Area } from '@/lib/areas'

/*
 * The type scale, used everywhere (nothing smaller than 13px):
 *   page title 30 · section/card title 17 · body 15 · meta 14 · chips 13
 *   key numbers: 40 on the Overview, 30 inside pages.
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function AreaIcon({ area, size = 'md' }: { area: Pick<Area, 'icon' | 'accent'>; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = area.icon
  return (
    <span
      aria-hidden
      className={cx(
        'inline-grid shrink-0 place-items-center rounded-xl ring-1 ring-inset',
        area.accent.tile,
        size === 'lg' ? 'size-12' : size === 'md' ? 'size-10' : 'size-8 rounded-lg',
      )}>
      <Icon className={size === 'lg' ? 'size-6' : size === 'md' ? 'size-5' : 'size-4'} />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Actions: inside the admin (arrow) vs another site (arrow out of a box, new tab)

type ActionProps = {
  href: string
  /** A short label ("Billing"); `describe` says the whole thing for tooltips and screen readers. */
  children: ReactNode
  describe?: string
  variant?: 'primary' | 'secondary' | 'quiet'
  icon?: IconType
}

const ACTION = {
  primary: 'bg-cyan-400 text-darkBlue hover:bg-cyan-300',
  secondary: 'bg-white/[0.07] text-slate-100 ring-1 ring-inset ring-white/10 hover:bg-white/[0.12]',
  quiet: 'text-cyan-300 hover:text-cyan-200',
}

/** Goes somewhere outside the admin, in a new tab. */
export function ExternalAction({ href, children, describe, variant = 'secondary', icon }: ActionProps) {
  // Every button to GitHub carries its mark, so the destination reads at a glance.
  const Icon = icon ?? (href.startsWith('https://github.com/') ? LuGithub : undefined)
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={describe ? `${describe} (new tab)` : undefined}
      className={cx('inline-flex min-h-10 items-center gap-2 rounded-lg text-[14px] font-medium transition-colors', variant !== 'quiet' && 'px-3.5', ACTION[variant])}>
      {Icon && <Icon aria-hidden className="size-4" />}
      {children}
      <LuExternalLink aria-hidden className="size-3.5 opacity-70" />
      <span className="sr-only">{describe ? `: ${describe}, opens in a new tab` : '(opens in a new tab)'}</span>
    </a>
  )
}

/** Goes to another page of the admin. */
export function InternalAction({ href, children, describe, variant = 'secondary' }: ActionProps) {
  return (
    <Link href={href} title={describe} className={cx('inline-flex min-h-10 items-center gap-2 rounded-lg text-[14px] font-medium transition-colors', variant !== 'quiet' && 'px-3.5', ACTION[variant])}>
      {children}
      <LuArrowRight aria-hidden className="size-4" />
    </Link>
  )
}

export function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-center gap-2.5', className)}>{children}</div>
}

/** A small inline link to another site (inside rows and tables). */
export function OutLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={cx('inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200', className)}>
      {children}
      <LuExternalLink aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

// ---------------------------------------------------------------------------
// State

export type Tone = 'good' | 'bad' | 'warn' | 'idle' | 'running'

const PILL: Record<Tone, { className: string; icon: IconType }> = {
  good: { className: 'bg-emerald-400/12 text-emerald-300', icon: LuCircleCheck },
  bad: { className: 'bg-rose-400/15 text-rose-200', icon: LuCircleAlert },
  warn: { className: 'bg-amber-300/15 text-amber-200', icon: LuTriangleAlert },
  idle: { className: 'bg-white/[0.07] text-slate-300', icon: LuCircleDashed },
  running: { className: 'bg-sky-400/12 text-sky-200', icon: LuCircleDashed },
}

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { className, icon: Icon } = PILL[tone]
  return (
    <span className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium', className)}>
      <Icon aria-hidden className="size-3.5" />
      {children}
    </span>
  )
}

const DOT: Record<Tone, string> = {
  good: 'bg-emerald-400',
  bad: 'bg-rose-400',
  warn: 'bg-amber-300',
  idle: 'bg-slate-500',
  running: 'bg-sky-400 animate-pulse',
}

export function Dot({ tone, label }: { tone: Tone; label?: string }) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cx('inline-block size-2.5 shrink-0 rounded-full', DOT[tone])} />
}

// ---------------------------------------------------------------------------
// Layout

/** The one card surface. */
export const CARD = 'rounded-2xl bg-[#0b1226] ring-1 ring-inset ring-white/[0.06]'

/** A titled section of a page. Its body streams in its own Suspense boundary. */
export function Panel({
  id,
  title,
  description,
  actions,
  className,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cx(CARD, 'flex min-w-0 flex-col p-6 sm:p-7', className)}>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <h2 id={`${id}-title`} className="text-[17px] font-semibold text-slate-50">
            {title}
          </h2>
          {description && <p className="mt-1.5 text-[15px] leading-relaxed text-slate-400">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  )
}

/** A page's heading: icon, title, one-line lead, the "What this is" facts and the main actions. */
export function PageHeader({ area, lead, actions }: { area: Area; lead?: ReactNode; actions?: ReactNode }) {
  const facts = area.about.map((fact) => (
    <li key={fact} className="flex gap-3">
      <span aria-hidden className={cx('mt-2.5 size-1.5 shrink-0 rounded-full', area.accent.bar)} />
      <span>{fact}</span>
    </li>
  ))
  return (
    <header className="mb-10">
      {/* One set of actions: beside the title from sm up, under the lead on phones (flex order). */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="order-1 flex min-w-0 items-center gap-4">
          <AreaIcon area={area} size="lg" />
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-balance text-slate-50 sm:text-[30px]">{area.label}</h1>
        </div>
        <p className="order-2 max-w-3xl basis-full text-[16px] leading-relaxed text-slate-300 sm:order-3">{lead ?? area.summary}</p>
        {actions && <Actions className="order-3 sm:order-2">{actions}</Actions>}
      </div>
      {area.about.length > 0 && (
        <>
          {/* Wide screens: the facts side by side, always visible. */}
          <section aria-label="What this is and why it matters" className="mt-6 hidden rounded-2xl bg-white/[0.025] p-6 ring-1 ring-inset ring-white/[0.05] lg:block">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-200">
              <LuInfo aria-hidden className={cx('size-4', area.accent.text)} />
              What this is and why it matters
            </p>
            <ul className="mt-4 grid grid-cols-3 gap-8 text-[15px] leading-relaxed text-slate-300">{facts}</ul>
          </section>
          {/* Phones: folded, so the data comes first. */}
          <details className="group mt-5 rounded-xl bg-white/[0.025] px-5 py-4 ring-1 ring-inset ring-white/[0.05] lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
              <LuInfo aria-hidden className={cx('size-4', area.accent.text)} />
              What this is and why it matters
              <LuChevronDown aria-hidden className="ml-auto size-4 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-300">{facts}</ul>
          </details>
        </>
      )}
    </header>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'bad' | 'warn' | 'good' }) {
  return (
    <div className="min-w-0">
      <p className="text-[14px] text-slate-400">{label}</p>
      <p className={cx('mt-1 text-[30px] leading-tight font-semibold tabular-nums', tone === 'bad' ? 'text-rose-300' : tone === 'warn' ? 'text-amber-200' : tone === 'good' ? 'text-emerald-300' : 'text-slate-50')}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[14px] text-slate-400">{hint}</p>}
    </div>
  )
}

/** A horizontal meter, e.g. minutes used of the free 2,000. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const share = Math.min(1, max > 0 ? value / max : 0)
  const tone = share >= 1 ? 'bg-rose-400' : share >= 0.7 ? 'bg-amber-300' : 'bg-cyan-400'
  return (
    <div role="meter" aria-label={label} aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} className="h-3 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div className={cx('h-full rounded-full', tone)} style={{ width: `${Math.max(share * 100, value > 0 ? 1.5 : 0)}%` }} />
    </div>
  )
}

/** A ranked list with proportional bars (top pages, per-repo counts). */
export function BarList({ rows, format = String }: { rows: { label: string; value: number }[]; format?: (value: number) => string }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="relative flex items-center justify-between gap-4 overflow-hidden rounded-lg px-3 py-2 text-[15px]">
          <span aria-hidden className="absolute inset-y-0 left-0 rounded-lg bg-cyan-400/[0.1]" style={{ width: `${(row.value / max) * 100}%` }} />
          <span className="relative truncate text-slate-100">{row.label}</span>
          <span className="relative shrink-0 font-mono text-[14px] text-slate-200 tabular-nums">{format(row.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * What a page shows until its account resource exists: what it needs
 * (env var names only, never values), what it will show, the plan, and
 * actions to set it up.
 */
export function NotConnected({
  kind = 'not-connected',
  title,
  why,
  needs,
  willShow,
  plan,
  setupId,
  actions,
}: {
  kind?: 'not-connected' | 'needs-permission'
  title?: string
  why: ReactNode
  needs?: string[]
  willShow?: string[]
  plan?: ReactNode[]
  /** The Setup item that connects it. */
  setupId?: string
  actions?: ReactNode
}) {
  const permission = kind === 'needs-permission'
  const Icon = permission ? LuKeyRound : LuPlug
  const label = 'mb-2.5 text-[14px] font-medium text-slate-300'
  const intro = (
    <div className="flex flex-col gap-6">
      <div>
        <p className={cx('flex items-center gap-2.5 text-[16px] font-semibold', permission ? 'text-amber-200' : 'text-slate-100')}>
          <Icon aria-hidden className="size-5" />
          {title ?? (permission ? 'Needs a token permission' : 'Not connected yet')}
        </p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-slate-300">{why}</p>
      </div>
      {willShow && willShow.length > 0 && (
        <div>
          <p className={label}>Once connected it shows</p>
          <ul className="flex flex-wrap gap-2">
            {willShow.map((item) => (
              <li key={item} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-[14px] text-slate-200">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
  const next = (
    <div className="flex flex-col gap-6">
      {plan && plan.length > 0 && (
        <div>
          <p className={label}>The plan</p>
          <ol className="max-w-2xl list-decimal space-y-2 pl-5 text-[15px] leading-relaxed text-slate-300 marker:text-slate-400">
            {plan.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </div>
      )}
      {needs && needs.length > 0 && (
        <div>
          <p className={label}>Needs</p>
          <ul className="flex flex-wrap gap-2">
            {needs.map((name) => (
              <li key={name}>
                <code className="rounded-md bg-darkBlue px-2 py-1 font-mono text-[13px] text-cyan-200 ring-1 ring-inset ring-white/[0.06]">{name}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(setupId || actions) && (
        <Actions>
          {setupId && (
            <InternalAction href={`/setup#${setupId}`} variant="primary" describe="How to connect it, on the Setup page">
              Set up
            </InternalAction>
          )}
          {actions}
        </Actions>
      )}
    </div>
  )
  // Wide panels put what it is on the left and what to do on the right.
  return (
    <div className={cx('grid flex-1 content-start gap-8', !permission && plan && plan.length > 0 && 'xl:grid-cols-2 xl:gap-12', permission && 'rounded-xl bg-amber-300/[0.06] p-5 sm:p-6')}>
      {intro}
      {next}
    </div>
  )
}

export function PanelError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-rose-400/[0.08] p-5 text-[15px] text-rose-100">
      <LuCircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-rose-300" />
      <p>
        <span className="font-semibold">Couldn&apos;t load this.</span> <span className="text-rose-100/80">{message}</span>
      </p>
    </div>
  )
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-9 animate-pulse rounded-lg bg-white/[0.05]" style={{ width: `${94 - index * 8}%` }} />
      ))}
    </div>
  )
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}
