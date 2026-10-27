import type { Metadata } from 'next'
import Link from 'next/link'
import { Inline } from '@/components/Inline'
import { PageHeader, cx } from '@/components/ui'
import { requireOwner } from '@/lib/auth/owner'
import { allSetupStatuses, type SetupState } from '@/lib/setup-status'

export const metadata: Metadata = { title: 'Setup' }

const BADGE: Record<SetupState, string> = {
  done: 'bg-emerald-400/10 text-emerald-300',
  partial: 'bg-amber-300/10 text-amber-200',
  missing: 'bg-white/[0.05] text-slate-300',
  manual: 'bg-white/[0.05] text-slate-400',
}

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
        title="Setup"
        description={
          <>
            Everything you need to create so every page shows live data, with each item&apos;s status right now. Secrets go straight into Vercel or <code className="font-mono text-[0.9em] text-slate-300">.env.local</code>, never into a chat. The same list is in <code className="font-mono text-[0.9em] text-slate-300">docs/SETUP.md</code>.
          </>
        }
      />

      <div className="mb-10 max-w-3xl">
        <p className="mb-2 text-[13px] text-slate-300">
          {done} of {checkable.length} done{manual > 0 && <span className="text-slate-475">, plus {manual} to confirm in Vercel</span>}
        </p>
        <div className="flex gap-1">
          {items.map(({ item, status }) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-label={`${item.title}: ${status.label}`}
              className={cx('h-1.5 flex-1 rounded-full', status.state === 'done' ? 'bg-emerald-400/80' : status.state === 'partial' ? 'bg-amber-300/80' : 'bg-white/[0.08]')}
            />
          ))}
        </div>
      </div>

      <ol className="max-w-3xl space-y-4">
        {items.map(({ item, status }, index) => (
          <li key={item.id} id={item.id} className="scroll-mt-24 rounded-2xl bg-white/[0.025] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-[16px] font-semibold text-slate-100">
                <span className="mr-2 font-mono text-[13px] text-slate-475">{index + 1}</span>
                {item.title}
              </h2>
              <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-medium', BADGE[status.state])}>{status.label}</span>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-400">{item.why}</p>
            {status.note && (
              <p className="mt-2 text-[13px] text-amber-200/80">
                <Inline text={status.note} />
              </p>
            )}

            {item.vars.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {item.vars.map((v) => {
                  const set = isSet(v.name)
                  return (
                    <li
                      key={v.name}
                      title={v.where}
                      className={cx('flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px]', set ? 'bg-emerald-400/[0.07] text-emerald-200' : 'bg-white/[0.04] text-slate-300')}>
                      <span aria-hidden>{set ? '✓' : '○'}</span>
                      {v.name}
                      <span className="sr-only">{set ? 'is set' : 'is missing'}</span>
                      {v.optional && <span className="font-sans text-slate-475">optional</span>}
                    </li>
                  )
                })}
              </ul>
            )}

            <details className="group mt-5" open={status.state !== 'done'}>
              <summary className="cursor-pointer list-none text-[13px] font-medium text-cyan-300 hover:text-cyan-200 [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show the steps</span>
                <span className="hidden group-open:inline">Steps</span>
              </summary>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-slate-300 marker:font-mono marker:text-xs marker:text-slate-500">
                {item.steps.map((step) => (
                  <li key={step}>
                    <Inline text={step} />
                  </li>
                ))}
              </ol>
            </details>

            {item.powers.length > 0 && (
              <p className="mt-5 text-[13px] text-slate-475">
                Powers{' '}
                {item.powers.map((power, powerIndex) => (
                  <span key={power.href + power.label}>
                    {powerIndex > 0 && ', '}
                    <Link href={power.href} className="text-slate-300 hover:text-cyan-200">
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
