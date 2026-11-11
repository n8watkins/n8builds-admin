'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LuExternalLink, LuGlobe, LuLogOut, LuMenu, LuX } from 'react-icons/lu'
import icon from '@/assets/n8-icon.png'
import { AREAS, NAV_GROUPS, SITES, areaForPath } from '@/lib/areas'
import { cx } from './ui'

type NavProps = {
  login: string
  devBypass: boolean
  /** Setup items still to do, for the badge. */
  setupLeft: number
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-lg">
      <Image src={icon} alt="" width={32} height={32} className="rounded-lg" priority />
      <span className="text-[17px] font-semibold text-slate-50">
        n8builds <span className="font-normal text-slate-400">admin</span>
      </span>
    </Link>
  )
}

function Sites() {
  return (
    <div>
      <p className="mb-1 px-3 text-[13px] font-semibold text-slate-400">Your sites</p>
      <ul className="space-y-0.5">
        {SITES.map((site) => (
          <li key={site.href}>
            <a
              href={site.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-[15px] text-slate-200 transition-colors hover:bg-white/[0.05] hover:text-cyan-200">
              <LuGlobe aria-hidden className="size-[18px] text-cyan-300" />
              <span className="truncate">{site.label}</span>
              <LuExternalLink aria-hidden className="ml-auto size-3.5 shrink-0 text-slate-500" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavLinks({ setupLeft, onNavigate }: { setupLeft: number; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="space-y-4">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.title ?? index}>
          {group.title && <p className="mb-1 px-3 text-[13px] font-semibold text-slate-400">{group.title}</p>}
          <ul className="space-y-0.5">
            {group.areas.map((id) => {
              const area = AREAS[id]
              const active = pathname === area.href
              const Icon = area.icon
              return (
                <li key={id}>
                  <Link
                    href={area.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-3 rounded-lg px-3 py-1.5 text-[15px] transition-colors',
                      active ? 'bg-white/[0.08] font-medium text-white' : 'text-slate-300 hover:bg-white/[0.04] hover:text-white',
                    )}>
                    <Icon aria-hidden className={cx('size-[18px] shrink-0', area.accent.text)} />
                    <span className="truncate">{area.label}</span>
                    {id === 'setup' && setupLeft > 0 && (
                      <span className="ml-auto rounded-full bg-amber-300/15 px-2 py-0.5 text-[13px] font-medium text-amber-200">{setupLeft} to do</span>
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
  return (
    <div className="space-y-4 px-3">
      {devBypass ? (
        <p className="rounded-lg bg-amber-300/[0.08] px-3 py-2 text-[13px] leading-relaxed text-amber-200">Sign-in is skipped on this local copy. Production always requires GitHub.</p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[14px] text-slate-300">@{login}</span>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="flex items-center gap-1.5 text-[14px] text-slate-300 transition-colors hover:text-cyan-200">
              <LuLogOut aria-hidden className="size-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

/** Desktop: a fixed sidebar. */
export function Sidebar({ login, devBypass, setupLeft }: NavProps) {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col border-r border-white/[0.06] bg-[#070c1b] lg:flex">
      <div className="px-6 pt-6 pb-5">
        <Brand />
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        <nav aria-label="Dashboard">
          <NavLinks setupLeft={setupLeft} />
        </nav>
        <Sites />
      </div>
      <div className="border-t border-white/[0.06] py-4">
        <Account login={login} devBypass={devBypass} />
      </div>
    </aside>
  )
}

/** Phones and tablets: a top bar with the current page and a menu. */
export function MobileNav({ login, devBypass, setupLeft }: NavProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const current = areaForPath(pathname)
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-darkBlue/95 backdrop-blur-md lg:hidden">
      <div className="flex h-16 items-center justify-between gap-3 px-4">
        <Brand />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close the menu' : `Menu (now on ${current.label})`}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-10 items-center gap-2 rounded-lg bg-white/[0.07] px-3 text-[15px] text-slate-100 ring-1 ring-inset ring-white/10">
          {open ? <LuX aria-hidden className="size-5" /> : <LuMenu aria-hidden className="size-5" />}
          <span className="hidden min-[400px]:inline">Menu</span>
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-4rem)] space-y-7 overflow-y-auto border-t border-white/[0.06] px-3 pt-5 pb-8">
          <nav aria-label="Dashboard">
            <NavLinks setupLeft={setupLeft} onNavigate={() => setOpen(false)} />
          </nav>
          <Sites />
          <Account login={login} devBypass={devBypass} />
        </div>
      )}
    </header>
  )
}
