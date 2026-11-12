'use client'
import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ActionState } from '@/lib/action-state'

type Props = {
  /** A server action (the page's ./actions). */
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
  /** The page's main action (a filled button), e.g. sending an announcement. */
  primary?: boolean
  /** The button can't open the dialog yet (the form isn't ready). */
  disabled?: boolean
  fields: Record<string, string>
  /** A number to edit inside the dialog (the daily cap). */
  number?: { name: string; label: string; value: number; min: number; max: number; resetLabel?: string }
  /** A line above the dialog's buttons: where the change is recorded. */
  note?: ReactNode
  /** Called with each result, once the action has finished. */
  onResult?: (state: NonNullable<ActionState>) => void
}

const BUTTON = 'rounded-lg px-3 py-1.5 text-[13px] font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300'
const PRIMARY = 'inline-flex min-h-10 items-center rounded-lg bg-cyan-400 px-4 text-[14px] font-semibold text-darkBlue transition-colors hover:bg-cyan-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-slate-400'

/**
 * A button that opens a confirmation dialog; only the dialog's own button runs
 * the change. The result shows next to the button.
 */
export function ConfirmAction({ action, label, ariaLabel, title, description, confirmLabel, danger, primary, disabled, fields, number, note, onResult }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [state, formAction, pending] = useActionState(action, null)
  const [reset, setReset] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (state && !pending) {
      dialog.current?.close()
      onResult?.(state)
    }
    // onResult is the caller's; a new one each render must not report the same result twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, pending])

  return (
    <div className={`flex flex-col gap-1 ${primary ? 'items-start' : 'items-end'}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          setReset(false)
          dialog.current?.showModal()
        }}
        className={
          primary
            ? PRIMARY
            : `${BUTTON} ${danger ? 'text-rose-200 ring-rose-300/25 hover:bg-rose-500/15' : 'text-slate-200 ring-white/10 hover:bg-white/[0.06]'} disabled:cursor-not-allowed disabled:opacity-50`
        }
      >
        {label}
      </button>
      {state && (
        <p role="status" className={`max-w-xs text-[13px] ${primary ? 'text-left' : 'text-right'} ${state.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
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
          {note && <p className="text-[13px] text-slate-400">{note}</p>}
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
