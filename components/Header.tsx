import Image from 'next/image'
import icon from '@/assets/n8-icon.png'
import type { Owner } from '@/lib/auth/owner'
import { OUTBOUND_LINKS } from '@/lib/links'
import { ExternalIcon } from './icons'

export function Header({ owner }: { owner: Owner }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-darkBlue/85 backdrop-blur-md">
      {owner.devBypass && (
        <p className="border-b border-amber-300/20 bg-amber-300/[0.07] px-4 py-1.5 text-center text-xs text-amber-200">
          Local preview: sign-in is bypassed (ADMIN_DEV_BYPASS=1 under next dev). Production builds always require GitHub sign-in.
        </p>
      )}
      <div className="mx-auto flex h-14 max-w-[1360px] items-center gap-4 px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          <Image src={icon} alt="" width={28} height={28} className="rounded-md" priority />
          <p className="truncate text-[15px] font-semibold text-slate-50">
            n8builds <span className="font-normal text-slate-450">admin</span>
          </p>
          <span className="hidden rounded-full border border-cyan-400/25 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-cyan-300 uppercase sm:inline">
            Owner only
          </span>
        </div>
        <nav aria-label="Other dashboards" className="ml-auto hidden items-center gap-1 lg:flex">
          {OUTBOUND_LINKS.map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-cyan-200">
              {link.label}
              <ExternalIcon className="size-3 opacity-60" />
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 lg:ml-2 lg:border-l lg:pl-4">
          <span className="hidden text-[13px] text-slate-400 sm:inline">@{owner.login}</span>
          {!owner.devBypass && (
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="rounded-md border px-2.5 py-1 text-[13px] text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200">
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  )
}
