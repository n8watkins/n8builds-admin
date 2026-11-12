'use client'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useId, useMemo, useState } from 'react'
import { LuInfo, LuTriangleAlert } from 'react-icons/lu'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Meter, cx } from '@/components/ui'
import { allowanceNotice, fieldChecks, fieldsReady, formatPeople, type Allowance, type ProjectChoice } from '@/lib/announce-view'
import type { AnnouncePreview, AnnounceTemplate } from '@/lib/announcements'
import { formatNumber } from '@/lib/format'
import { previewAnnouncement, sendTestAnnouncement, startAnnouncement } from './actions'

type Props = {
  choices: ProjectChoice[]
  templates: AnnounceTemplate[]
  /** n8builds-web's mailroom allowance; null when mailroom can't be read. */
  allowance: Allowance | null
}

const LEGEND = 'mb-3 text-[14px] font-semibold text-slate-200'
const COUNT: Record<'good' | 'warn' | 'bad', string> = { good: 'text-slate-400', warn: 'text-amber-200', bad: 'text-rose-300' }
const INPUT = 'w-full rounded-lg bg-white/[0.05] px-3 py-2 text-[15px] text-slate-50 ring-1 ring-inset ring-white/10 placeholder:text-slate-500 focus:outline-2 focus:outline-offset-0 focus:outline-sky-300'
const SECONDARY = 'inline-flex min-h-10 items-center rounded-lg bg-white/[0.07] px-4 text-[14px] font-medium text-slate-100 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:opacity-50'

/** Compose an announcement: project, template, the words, a live preview, a test to yourself, then the real send. */
export function Composer({ choices, templates, allowance }: Props) {
  const router = useRouter()
  const [project, setProject] = useState(() => choices.find((choice) => choice.available)?.slug ?? '')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 'open')
  // One value per field key, shared across templates, so switching keeps the words.
  const [values, setValues] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<{ key: string; data: AnnouncePreview } | { key: string; error: string } | null>(null)
  const [testState, testAction, testing] = useActionState(sendTestAnnouncement, null)
  const ids = useId()

  const template = templates.find((t) => t.id === templateId) ?? templates[0]
  const choice = choices.find((c) => c.slug === project && c.available) ?? null
  const ready = Boolean(choice && template && fieldsReady(template, values))
  const fields = useMemo(() => JSON.stringify(Object.fromEntries((template?.fields ?? []).map((field) => [field.key, (values[field.key] ?? '').trim()]))), [template, values])
  const key = `${project}|${templateId}|${fields}`

  // The live preview: n8builds-web renders it, a moment after the last keystroke.
  useEffect(() => {
    if (!ready) return
    let stale = false
    const timer = setTimeout(async () => {
      const result = await previewAnnouncement({ project, template: templateId, fields: JSON.parse(fields) as Record<string, string> }).catch((error: unknown) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : 'The preview failed.',
      }))
      if (!stale) setPreview(result.ok ? { key, data: result.preview } : { key, error: result.message })
    }, 350)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [ready, project, templateId, fields, key])

  const current = ready && preview?.key === key ? preview : null
  const shown = current && 'data' in current ? current.data : null
  const recipients = shown?.recipients ?? choice?.confirmed ?? 0
  const notice = allowanceNotice(recipients, allowance)
  const hidden = { project, template: templateId, fields }

  if (!template) return <p className="text-[15px] text-slate-400">n8builds-web has no templates yet.</p>

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:gap-10">
      <div className="flex min-w-0 flex-col gap-7">
        <fieldset>
          <legend className={LEGEND}>Project</legend>
          {choices.length === 0 ? (
            <p className="text-[15px] text-slate-400">No project has a waitlist yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {choices.map((c) => (
                <li key={c.slug}>
                  <label
                    className={cx(
                      'flex h-full gap-3 rounded-xl p-3.5 ring-1 ring-inset transition-colors',
                      !c.available ? 'cursor-not-allowed bg-white/[0.015] ring-white/[0.05]' : project === c.slug ? 'cursor-pointer bg-sky-400/[0.08] ring-sky-300/40' : 'cursor-pointer bg-white/[0.03] ring-white/[0.08] hover:bg-white/[0.05]',
                    )}>
                    <input type="radio" name={`${ids}-project`} value={c.slug} checked={project === c.slug} disabled={!c.available} onChange={() => setProject(c.slug)} className="mt-1 size-4 shrink-0 accent-sky-400" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={cx('text-[15px] font-medium', c.available ? 'text-slate-50' : 'text-slate-400')}>{c.name}</span>
                      <span className="text-[13px] text-slate-300 tabular-nums">{formatPeople(c.confirmed)} confirmed</span>
                      <span className={cx('text-[13px]', c.opensAt ? 'text-amber-200/90' : 'text-slate-400')}>{c.note}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <AllowanceBox allowance={allowance} />

        <fieldset>
          <legend className={LEGEND}>Template</legend>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <label
                key={t.id}
                className={cx(
                  'inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-medium ring-1 ring-inset transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sky-300',
                  templateId === t.id ? 'bg-sky-400/15 text-sky-100 ring-sky-300/40' : 'bg-white/[0.03] text-slate-300 ring-white/10 hover:bg-white/[0.06]',
                )}>
                <input type="radio" name={`${ids}-template`} value={t.id} checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="sr-only" />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-4">
          {template.fields.map((field) => {
            const check = fieldChecks(template, values).find((c) => c.key === field.key)
            const id = `${ids}-${field.key}`
            const control = {
              id,
              value: values[field.key] ?? '',
              onChange: (event: { target: { value: string } }) => setValues((old) => ({ ...old, [field.key]: event.target.value })),
              'aria-describedby': `${id}-count`,
              'aria-invalid': check && check.length > check.max ? true : undefined,
              className: INPUT,
            }
            return (
              <div key={field.key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={id} className="text-[14px] font-medium text-slate-200">
                    {field.label}
                  </label>
                  <span id={`${id}-count`} className={cx('font-mono text-[13px] tabular-nums', COUNT[check?.length === 0 ? 'good' : (check?.tone ?? 'good')])}>
                    {check?.label}
                    <span className="sr-only"> characters</span>
                  </span>
                </div>
                {field.max > 200 ? <textarea rows={field.max > 600 ? 7 : 5} {...control} /> : <input type={field.key === 'link' ? 'url' : 'text'} {...control} />}
              </div>
            )
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5">
          {notice && (
            <p role="status" className={cx('flex items-start gap-2.5 rounded-xl p-3.5 text-[14px] leading-relaxed', notice.tone === 'warn' ? 'bg-amber-300/[0.08] text-amber-100 ring-1 ring-inset ring-amber-300/25' : 'bg-white/[0.03] text-slate-300')}>
              {notice.tone === 'warn' ? <LuTriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-200" /> : <LuInfo aria-hidden className="mt-0.5 size-4 shrink-0 text-slate-400" />}
              {notice.message}
            </p>
          )}
          <div className="flex flex-wrap items-start gap-3">
            <form action={testAction} className="flex flex-col gap-1">
              {Object.entries(hidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button type="submit" disabled={!ready || testing} className={SECONDARY}>
                {testing ? 'Sending the test…' : 'Send test to me'}
              </button>
              {testState && (
                <p role="status" className={cx('max-w-xs text-[13px]', testState.ok ? 'text-emerald-300' : 'text-rose-300')}>
                  {testState.message}
                </p>
              )}
            </form>
            <ConfirmAction
              action={startAnnouncement}
              primary
              disabled={!shown || !choice}
              label={`Send to ${formatPeople(recipients)}`}
              title={`Send to ${formatPeople(recipients)}?`}
              description={
                <>
                  <span className="block">
                    Everyone who confirmed the <span className="font-semibold text-slate-100">{choice?.name}</span> waitlist ({formatPeople(recipients)}) gets &ldquo;{shown?.subject}&rdquo; by email from n8builds.dev.
                  </span>
                  <span className="mt-2 block font-medium text-amber-100">It can&apos;t be unsent. Cancel on History only stops the emails not sent yet.</span>
                  {notice && <span className="mt-2 block text-[14px] text-slate-400">{notice.message}</span>}
                </>
              }
              confirmLabel="Send it"
              fields={hidden}
              note="n8builds-web sends it through mailroom and records your GitHub login as who started it."
              onResult={(result) => {
                if (result.ok) router.push('/announcements?tab=history')
              }}
            />
          </div>
          {!ready && <p className="text-[13px] text-slate-400">{choice ? 'Fill in every field to preview and send.' : 'Pick a project that can be announced.'}</p>}
        </div>
      </div>

      <section aria-labelledby={`${ids}-preview`} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 id={`${ids}-preview`} className="text-[14px] font-semibold text-slate-200">
            Preview
          </h3>
          {ready && !current && <span className="text-[13px] text-slate-400">Updating…</span>}
        </div>
        {current && 'error' in current ? (
          <p role="alert" className="rounded-xl bg-rose-400/[0.08] p-4 text-[14px] text-rose-100">
            {current.error}
          </p>
        ) : shown ? (
          <>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
              <dt className="text-slate-400">Subject</dt>
              <dd className="font-medium [overflow-wrap:anywhere] text-slate-50">{shown.subject}</dd>
              <dt className="text-slate-400">To</dt>
              <dd className="text-slate-200">
                {formatPeople(shown.recipients)} on the {choice?.name} waitlist
              </dd>
            </dl>
            {/* Sandboxed: no scripts, no links followed, no access to this page. */}
            <iframe title="Email preview" sandbox="" srcDoc={shown.html} className="h-[560px] w-full rounded-xl bg-white ring-1 ring-white/10" />
          </>
        ) : (
          <div className="grid h-[200px] place-items-center rounded-xl bg-white/[0.02] p-6 text-center text-[14px] text-slate-400 ring-1 ring-inset ring-white/[0.06] xl:h-[560px]">
            {ready ? 'Rendering the email…' : 'The email shows here once a project is picked and every field is filled in.'}
          </div>
        )}
      </section>
    </div>
  )
}

function AllowanceBox({ allowance }: { allowance: Allowance | null }) {
  if (!allowance) {
    return (
      <p className="rounded-xl bg-white/[0.03] p-4 text-[14px] text-slate-400 ring-1 ring-inset ring-white/[0.06]">
        mailroom isn&apos;t connected here, so the emails n8builds-web has left this month can&apos;t be checked. A send past its cap pauses and resumes on its own.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/[0.06]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[14px] text-slate-300">n8builds-web&apos;s email this month</p>
        <p className="text-[14px] text-slate-400">
          <span className={cx('font-mono font-semibold tabular-nums', allowance.monthLeft === 0 ? 'text-rose-300' : 'text-slate-50')}>{formatNumber(allowance.monthLeft)}</span> left of{' '}
          <span className="font-mono text-slate-200 tabular-nums">{formatNumber(allowance.monthCap)}</span>
        </p>
      </div>
      <Meter size="sm" value={allowance.monthUsed} max={allowance.monthCap} label={`n8builds-web has sent ${allowance.monthUsed} of its ${allowance.monthCap} emails this month`} />
      <p className="text-[13px] text-slate-400">
        {formatNumber(allowance.dayLeft)} left of {formatNumber(allowance.dayCap)} today. Everything n8builds-web sends counts against it.
        {allowance.paused && <span className="text-amber-200"> Paused in mailroom.</span>}
      </p>
    </div>
  )
}
