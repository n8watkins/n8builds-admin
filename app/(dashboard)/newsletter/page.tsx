import type { Metadata } from 'next'
import { LuExternalLink, LuKeyRound } from 'react-icons/lu'
import { ConfirmAction } from '@/components/ConfirmAction'
import { NotConnected, PageHeader, Panel, PanelError, Stat, StatusPill } from '@/components/ui'
import { AREAS } from '@/lib/areas'
import { requireOwner } from '@/lib/auth/owner'
import { formatNumber } from '@/lib/format'
import { KIT_APP_URL, readNewsletterStatus, shortDateTime, switchLabel, type NewsletterStatus } from '@/lib/newsletter'
import { setNewsletter } from './actions'

const area = AREAS.newsletter

export const metadata: Metadata = { title: area.label }
// Always live: the switch must show what n8builds-web has now.
export const dynamic = 'force-dynamic'

function NewsletterNotConnected() {
  return (
    <NotConnected
      why="Turns the n8builds newsletter on and off, and shows Kit's side of it, from n8builds-web."
      willShow={['The on/off switch, who changed it and when', 'Whether the Kit key is set', 'Confirmed readers in Kit']}
      needs={['NEWSLETTER (service binding to n8builds-web, entrypoint NewsletterAdmin)']}
    />
  )
}

/** Plainly why the switch can't take effect yet. */
function NoKitKey({ on }: { on: boolean }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl bg-amber-300/[0.08] p-4 text-[15px] text-amber-100 ring-1 ring-inset ring-amber-300/25">
      <LuKeyRound aria-hidden className="mt-0.5 size-5 shrink-0 text-amber-200" />
      <p>
        <span className="font-semibold">The Kit key isn&apos;t set on n8builds-web, so the newsletter stays off{on ? ' even with the switch on' : ''}.</span>{' '}
        <span className="text-amber-100/80">It goes live once the Worker secret KIT_API_KEY is set (pass-env n8builds/KIT_API_KEY).</span>
      </p>
    </div>
  )
}

function Switch({ status }: { status: NewsletterStatus }) {
  const { label, tone } = switchLabel(status)
  const turningOn = !status.on
  // Turning it on can't take effect without the key: the button waits for it (turning off always works).
  const blocked = turningOn && !status.kit.configured
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] text-slate-400">Newsletter</p>
          <p className="mt-1.5">
            <StatusPill tone={tone}>{label}</StatusPill>
          </p>
          <p className="mt-2 text-[14px] text-slate-400">
            {status.at ? (
              <>
                Turned {status.on ? 'on' : 'off'} by <span className="text-slate-200">{status.by ?? 'unknown'}</span>, {shortDateTime(status.at)}
              </>
            ) : (
              'Never changed: off by default.'
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <ConfirmAction
            action={setNewsletter}
            label={turningOn ? 'Turn newsletter on' : 'Turn newsletter off'}
            title={turningOn ? 'Turn the newsletter on?' : 'Turn the newsletter off?'}
            description={
              turningOn
                ? 'Within a minute, the sign-up forms show on n8builds.dev, and waitlist sign-ups go to Kit with a tag per project. Kit sends each confirm email.'
                : 'Within a minute, every newsletter form disappears from n8builds.dev and the waitlist goes back to its own confirm emails. Kit keeps everyone already signed up.'
            }
            confirmLabel={turningOn ? 'Turn on' : 'Turn off'}
            danger={!turningOn}
            primary={turningOn}
            disabled={blocked}
            note="n8builds-web records the change with your GitHub login."
            fields={{ on: String(turningOn) }}
          />
          {blocked && <p className="text-[13px] text-slate-400">Needs the Kit key on n8builds-web first.</p>}
        </div>
      </div>
      {!status.kit.configured && <NoKitKey on={status.on} />}
      {status.log.length > 0 && (
        <div>
          <p className="mb-2 text-[14px] font-medium text-slate-300">Recent changes</p>
          <ul className="flex flex-col text-[14px]">
            {status.log.map((change, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-t border-white/[0.06] py-2 first:border-t-0">
                <span className="text-slate-100">Turned {change.on ? 'on' : 'off'}</span>
                <span className="text-slate-400 tabular-nums">
                  {change.by ?? 'unknown'}, {shortDateTime(change.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Kit({ status }: { status: NewsletterStatus }) {
  const { kit } = status
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
        <Stat label="Confirmed in Kit" value={kit.confirmed === null ? '-' : formatNumber(kit.confirmed)} hint={kit.configured ? 'active subscribers' : 'needs the Kit key'} />
        <Stat label="Kit key" value={kit.configured ? 'Set' : 'Not set'} tone={kit.configured ? 'good' : 'warn'} hint="KIT_API_KEY on n8builds-web" />
        <Stat label="Sign-up form" value={kit.formId ?? '-'} hint={kit.formId ? 'double opt-in' : 'set KIT_FORM_ID or keep one form'} />
      </div>
      {kit.error && <PanelError message={kit.error} />}
      <p className="text-[14px] leading-relaxed text-slate-400">
        Readers, topics, broadcasts and unsubscribes are managed in Kit; no address is kept on n8builds.dev or here.{' '}
        <a href={KIT_APP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 underline underline-offset-2 hover:text-sky-200">
          Open Kit
          <LuExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  )
}

export default async function Page() {
  await requireOwner()
  const loaded = await readNewsletterStatus()
  return (
    <>
      <PageHeader area={area} />
      <div className="flex flex-col gap-5">
        {loaded.state === 'off' ? (
          <Panel id="switch" title="Turn newsletter on/off">
            <NewsletterNotConnected />
          </Panel>
        ) : loaded.state === 'error' ? (
          <Panel id="switch" title="Turn newsletter on/off">
            <PanelError message={loaded.message} />
          </Panel>
        ) : (
          <>
            <Panel id="switch" title="Turn newsletter on/off" description="Off hides every newsletter form on n8builds.dev, and the waitlist keeps its own confirm emails. On sends sign-ups to Kit.">
              <Switch status={loaded.status} />
            </Panel>
            <Panel id="kit" title="Managed in Kit">
              <Kit status={loaded.status} />
            </Panel>
          </>
        )}
      </div>
    </>
  )
}
