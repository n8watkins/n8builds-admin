import Link from 'next/link'
import { cx } from './ui'

/**
 * A page's sections as tabs. Each tab is a link with its own address
 * (`?tab=<id>`; the first tab is the page itself), so it works without
 * JavaScript, survives a reload and can be shared.
 */
export type Tab = { id: string; label: string }

/** The tab a `?tab=` value names, or the first one for anything else. */
export function currentTab<const T extends readonly [Tab, ...Tab[]]>(tabs: T, value: string | string[] | undefined): T[number] {
  return tabs.find((tab) => tab.id === value) ?? tabs[0]
}

export function Tabs({
  label,
  path,
  tabs,
  current,
  counts = {},
}: {
  /** Names the navigation for screen readers ("Mailroom sections"). */
  label: string
  /** The page's own path ("/mailroom"). */
  path: string
  tabs: readonly Tab[]
  current: string
  /** An optional number beside a tab's label, shown when above zero. */
  counts?: Partial<Record<string, number>>
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 border-b border-white/[0.08]">
        {tabs.map((tab, index) => {
          const active = tab.id === current
          const count = counts[tab.id]
          return (
            <li key={tab.id}>
              <Link
                href={index === 0 ? path : `${path}?tab=${tab.id}`}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  '-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-300',
                  active ? 'border-sky-400 text-slate-50' : 'border-transparent text-slate-400 hover:text-slate-200',
                )}>
                {tab.label}
                {count !== undefined && count > 0 && <span className={cx('rounded-full px-1.5 text-[12px] tabular-nums', active ? 'bg-sky-400/20 text-sky-100' : 'bg-white/[0.08] text-slate-300')}>{count}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
