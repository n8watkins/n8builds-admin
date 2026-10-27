import type { Metadata } from 'next'
import Link from 'next/link'
import { LuCircleCheck, LuCircleDashed } from 'react-icons/lu'
import { Inline } from '@/components/Inline'
import { Actions, CARD, ExternalAction, PageHeader, StatusPill, cx, type Tone } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { allSetupStatuses, type SetupState } from '@/lib/setup-status'

export const metadata: Metadata = { title: 'Setup' }

const PILL: Record<SetupState, Tone> = { done: 'good', partial: 'warn', missing: 'idle', manual: 'idle' }

function isSet(name: string): boolean {
  return Boolean(process.env[name]?.trim())
}

export default async function SetupPage() {
  await requireOwner()
  const items = await allSetupStatuses()
  const checkable = items.filter(({ status }) => status.state !== 'manual')
  const done = checkable.filter(({ status }) => status.state === 'done').length
  const manual = items.length - checkable.length
  return (
    <>
      <PageHeader
        area={AREAS.setup}
        lead={
          <>
            Everything to create once so every page shows live data, with each item&apos;s status right now. Put secrets straight into Vercel or <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.9em]">.env.local</code>, never into a chat. The same list lives in <code className="rounded bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.9em]">docs/SETUP.md</code>.
          </>
        }
      />

      <div className={cx(CARD, 'mb-10 max-w-4xl p-6 sm:p-7')}>
        <p className="text-[17px] font-semibold text-slate-50">
          {done} of {checkable.length} done
          {manual > 0 && <span className="font-normal text-slate-400">, plus {manual} to confirm in Vercel</span>}
        </p>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2">
          {items.map(({ item, status }, index) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-slate-200 hover:bg-white/[0.05]">
                {status.state === 'done' ? <LuCircleCheck aria-hidden className="size-5 shrink-0 text-emerald-300" /> : <LuCircleDashed aria-hidden className={cx('size-5 shrink-0', status.state === 'partial' ? 'text-amber-200' : 'text-slate-500')} />}
                <span className="min-w-0 truncate">
                  {index + 1}. {item.title.split(':')[0]}
                </span>
                <span className="ml-auto shrink-0 text-[14px] text-slate-400">{status.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      <ol className="max-w-4xl space-y-6">
        {items.map(({ item, status }, index) => (
          <li key={item.id} id={item.id} className={cx(CARD, 'scroll-mt-24 p-6 sm:p-8')}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[20px] leading-snug font-semibold text-slate-50">
                <span className="mr-2 text-slate-400">{index + 1}.</span>
                {item.title}
              </h2>
              <StatusPill tone={PILL[status.state]}>{status.label}</StatusPill>
            </div>
            <p className="mt-3 text-[16px] leading-relaxed text-slate-300">{item.why}</p>
            {status.note && (
              <p className="mt-3 rounded-lg bg-amber-300/[0.07] px-4 py-3 text-[15px] text-amber-100">
                <Inline text={status.note} />
              </p>
            )}

            {item.vars.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-[15px] font-medium text-slate-200">Environment variables</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {item.vars.map((v) => {
                    const set = isSet(v.name)
                    return (
                      <li key={v.name} className={cx('rounded-lg px-4 py-3', set ? 'bg-emerald-400/[0.07]' : 'bg-white/[0.04]')}>
                        <p className="flex items-center gap-2 font-mono text-[14px] text-slate-100">
                          {set ? <LuCircleCheck aria-hidden className="size-4 text-emerald-300" /> : <LuCircleDashed aria-hidden className="size-4 text-slate-500" />}
                          <span className="min-w-0 [overflow-wrap:anywhere]">{v.name}</span>
                        </p>
                        <p className="mt-1 text-[14px] text-slate-400">
                          {set ? 'Set' : v.optional ? 'Optional, not set' : 'Missing'} · <Inline text={v.where} />
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <details className="group mt-6" open={status.state !== 'done'}>
              <summary className="cursor-pointer list-none text-[15px] font-medium text-cyan-300 hover:text-cyan-200 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show the steps</span>
                <span className="hidden text-slate-200 group-open:inline">Steps</span>
              </summary>
              <ol className="mt-3 list-decimal space-y-2.5 pl-6 text-[15px] leading-relaxed text-slate-300 marker:text-slate-500">
                {item.steps.map((step) => (
                  <li key={step} className="pl-1">
                    <Inline text={step} />
                  </li>
                ))}
              </ol>
            </details>

            {item.links.length > 0 && (
              <Actions className="mt-6">
                {item.links.map((link, linkIndex) => (
                  <ExternalAction key={link.href} href={link.href} variant={linkIndex === 0 && status.state !== 'done' ? 'primary' : 'secondary'}>
                    {link.label}
                  </ExternalAction>
                ))}
              </Actions>
            )}

            {item.powers.length > 0 && (
              <p className="mt-6 text-[15px] text-slate-400">
                Powers{' '}
                {item.powers.map((power, powerIndex) => (
                  <span key={power.href + power.label}>
                    {powerIndex > 0 && ', '}
                    <Link href={power.href} className="text-cyan-300 hover:text-cyan-200">
                      {power.label}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ol>
    </>
  )
}
