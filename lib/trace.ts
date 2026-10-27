/**
 * Opt-in timing of upstream calls (ADMIN_TRACE=1): one log line per request
 * with its duration and whether it came from the cache, to find slow panels.
 */
export function traceEnabled(): boolean {
  return process.env.ADMIN_TRACE === '1'
}

export async function traced<T>(label: string, run: () => Promise<T>): Promise<T> {
  if (!traceEnabled()) return run()
  const started = performance.now()
  try {
    return await run()
  } finally {
    console.log(`[trace] ${Math.round(performance.now() - started).toString().padStart(5)}ms ${label}`)
  }
}
