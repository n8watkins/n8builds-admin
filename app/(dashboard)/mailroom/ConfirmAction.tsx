'use client'
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ActionState } from './actions'

type Props = {
  /** A server action from ./actions. */
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  /** The button that opens the confirmation. */
  label: string
  /** Its accessible name, when the label alone is ambiguous in a list. */
  ariaLabel?: string
  title: string
  /** What will happen, in one or two sentences. */
  description: ReactNode
  confirmLabel: string
  danger?: boolean
  fields: Record<string, string>
  /** A number to edit inside the dialog (the daily cap). */
  number?: { name: string; label: string; value: number; min: number; max: number; resetLabel?: string }
}

const BUTTON = 'rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300'

/**
 * A button that opens a confirmation dialog; only the dialog's own button runs
 * the change. The result shows next to the button, and mailroom has already
 * written it to its audit log.
 */
export function ConfirmAction({ action, label, ariaLabel, title, description, confirmLabel, danger, fields, number }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [state, formAction, pending] = useActionState(action, null)
  const [reset, setReset] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (state && !pending) dialog.current?.close()
  }, [state, pending])

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => {
          setReset(false)
          dialog.current?.showModal()
        }}
        className={`${BUTTON} ${danger ? 'text-rose-200 ring-rose-300/25 hover:bg-rose-500/15' : 'text-slate-200 ring-white/10 hover:bg-white/[0.06]'}`}
      >
        {label}
      </button>
      {state && (
        <p role="status" className={`max-w-xs text-right text-[13px] ${state.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
          {state.message}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-[#0e1730] p-0 text-slate-100 shadow-2xl ring-1 ring-white/10 backdrop:bg-black/60"
      >
        <form action={formAction} className="flex flex-col gap-5 p-6">
          <div>
            <h2 id={titleId} className="text-[17px] font-semibold text-slate-50">
              {title}
            </h2>
            <div className="mt-2 text-[15px] leading-relaxed text-slate-300">{description}</div>
          </div>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {number && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-[14px] text-slate-300">
                {number.label}
                <input
                  type="number"
                  name={number.name}
                  defaultValue={number.value}
                  min={number.min}
                  max={number.max}
                  step={1}
                  required={!reset}
                  disabled={reset}
                  className="w-32 rounded-lg bg-white/[0.06] px-3 py-2 font-mono text-[15px] text-slate-50 ring-1 ring-white/10 disabled:opacity-40"
                />
              </label>
              {number.resetLabel && (
                <label className="flex items-center gap-2 text-[14px] text-slate-300">
                  <input type="checkbox" name="reset" value="true" checked={reset} onChange={(event) => setReset(event.target.checked)} className="size-4 accent-sky-400" />
                  {number.resetLabel}
                </label>
              )}
            </div>
          )}
          <p className="text-[13px] text-slate-400">This is recorded in mailroom&apos;s audit log with your GitHub login.</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className={`${BUTTON} text-slate-200 ring-white/10 hover:bg-white/[0.06]`}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`${BUTTON} ${danger ? 'bg-rose-500/20 text-rose-100 ring-rose-300/30 hover:bg-rose-500/30' : 'bg-sky-500/20 text-sky-100 ring-sky-300/30 hover:bg-sky-500/30'} disabled:opacity-50`}
            >
              {pending ? 'Working…' : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
