/** Small inline icons (decorative: aria-hidden). */
type IconProps = { className?: string }

const base = 'shrink-0'

export function GitHubIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="currentColor" className={`${base} ${className}`}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

export function ExternalIcon({ className = 'size-3.5' }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 3 13V5a.5.5 0 0 1 .5-.5H7" />
    </svg>
  )
}

export function PlugIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <path d="M6 1.5v3M10 1.5v3M4 4.5h8v2.5a4 4 0 0 1-8 0V4.5ZM8 11v3.5" />
    </svg>
  )
}

export function KeyIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <circle cx="5.5" cy="10.5" r="3" />
      <path d="M7.7 8.3 13.5 2.5M11.5 4.5l1.5 1.5M10 6l1.2 1.2" />
    </svg>
  )
}

export function AlertIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${className}`}>
      <path d="M8 1.8 14.8 13.5H1.2L8 1.8ZM8 6.2v3.3M8 11.6v.1" />
    </svg>
  )
}
