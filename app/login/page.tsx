import type { Metadata } from 'next'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import icon from '@/assets/n8-icon.png'
import { GitHubIcon } from '@/components/icons'
import { getOwner } from '@/lib/auth/owner'
import { isAuthConfigured } from '@/lib/auth/tokens'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

const ERRORS: Record<string, string> = {
  'not-configured': 'Sign-in isn\'t set up yet: the GitHub OAuth App and session secret are missing (docs/SETUP.md, step 1).',
  state: 'That sign-in link expired or was already used. Try again.',
  exchange: 'GitHub didn\'t confirm the sign-in. Try again.',
  'not-owner': 'This dashboard is private to its owner.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await getOwner()) redirect('/')
  const params = await searchParams
  const error = typeof params.error === 'string' ? ERRORS[params.error] : undefined
  const signedOut = params['signed-out'] === '1'
  const configured = isAuthConfigured()
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-panel/80 p-8 text-center">
        <Image src={icon} alt="" width={48} height={48} className="mx-auto rounded-lg" priority />
        <h1 className="mt-5 text-xl font-semibold text-slate-50">n8builds admin</h1>
        <p className="mt-1.5 text-sm text-slate-400">Private dashboard. Owner only.</p>
        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-rose-400/20 bg-rose-400/[0.05] px-3 py-2 text-[13px] text-rose-200">
            {error}
          </p>
        )}
        {signedOut && !error && <p className="mt-5 text-[13px] text-slate-400">Signed out.</p>}
        {configured ? (
          <a
            href="/api/auth/login"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-50 px-4 py-2.5 text-sm font-semibold text-darkBlue transition-colors hover:bg-cyan-100">
            <GitHubIcon />
            Sign in with GitHub
          </a>
        ) : (
          !error && <p className="mt-6 text-[13px] text-slate-450">{ERRORS['not-configured']}</p>
        )}
      </div>
    </main>
  )
}
