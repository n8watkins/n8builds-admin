'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import icon from '@/assets/n8-icon.png'
import { NAV, labelFor } from '@/lib/nav'
import { cx } from './ui'

type NavProps = {
  login: string
  devBypass: boolean
  /** Setup items still to do, for the badge. */
  setupLeft: number
  outbound: readonly { label: string; href: string }[]
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg">
      <Image src={icon} alt="" width={28} height={28} className="rounded-md" priority />
      <span className="text-[15px] font-semibold text-slate-50">
        n8builds <span className="font-normal text-slate-450">admin</span>
      </span>
    </Link>
  )
}

function NavLinks({ setupLeft, onNavigate }: { setupLeft: number; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="space-y-6">
      {NAV.map((group, index) => (
        <div key={group.title ?? index}>
          {group.title && <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.12em] text-slate-475 uppercase">{group.title}</p>}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[14px] transition-colors',
                      active ? 'bg-white/[0.06] font-medium text-slate-50' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-100',
                    )}>
                    {item.label}
                    {item.href === '/setup' && setupLeft > 0 && (
                      <span className="rounded-full bg-amber-300/10 px-1.5 py-px font-mono text-[11px] text-amber-200">{setupLeft} left</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Account({ login, devBypass }: { login: string; devBypass: boolean }) {
  return devBypass ? (
    <p className="text-xs leading-relaxed text-amber-200/80">Local preview: sign-in is bypassed. Production always requires GitHub sign-in.</p>
  ) : (
    <div className="flex items-center justify-between gap-3">
      <span className="truncate text-[13px] text-slate-400">@{login}</span>
      <form action="/api/auth/logout" method="post">
        <button type="submit" className="text-[13px] text-slate-400 transition-colors hover:text-cyan-200">
          Sign out
        </button>
      </form>
    </div>
  )
}

function Outbound({ links }: { links: NavProps['outbound'] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {links.map((link) => (
        <li key={link.label}>
          <a href={link.href} target="_blank" rel="noreferrer" className="text-xs text-slate-475 transition-colors hover:text-cyan-200">
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Desktop: a fixed sidebar. */
export function Sidebar({ login, devBypass, setupLeft, outbound }: NavProps) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-white/[0.05] bg-[#060a17] px-4 py-6 lg:flex">
      <div className="px-2">
        <Brand />
      </div>
      <nav aria-label="Dashboard" className="mt-8 flex-1 overflow-y-auto">
        <NavLinks setupLeft={setupLeft} />
      </nav>
      <div className="space-y-4 px-3 pt-6">
        <Outbound links={outbound} />
        <Account login={login} devBypass={devBypass} />
      </div>
    </aside>
  )
}

/** Phones and tablets: a top bar with the current page and a menu. */
export function MobileNav({ login, devBypass, setupLeft, outbound }: NavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.05] bg-darkBlue/90 backdrop-blur-md lg:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Brand />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5 text-[13px] text-slate-200">
          {labelFor(pathname)}
          <svg aria-hidden viewBox="0 0 16 16" className={cx('size-3.5 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Dashboard" className="max-h-[calc(100dvh-3.5rem)] space-y-6 overflow-y-auto border-t border-white/[0.05] px-3 pt-4 pb-6">
          <NavLinks setupLeft={setupLeft} onNavigate={() => setOpen(false)} />
          <div className="space-y-4 px-3">
            <Outbound links={outbound} />
            <Account login={login} devBypass={devBypass} />
          </div>
        </nav>
      )}
    </header>
  )
}
