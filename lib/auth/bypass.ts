import { isDevBypassEnabled } from './dev-bypass'
import { isTestAuthEnabled } from './test-auth'

/**
 * Whether sign-in is skipped: the local dev preview (lib/auth/dev-bypass.ts)
 * or a local E2E/Lighthouse build (lib/auth/test-auth.ts). Both are compiled
 * out of every real production build.
 */
export function signInSkipped(): 'dev' | 'test' | null {
  if (isDevBypassEnabled()) return 'dev'
  if (isTestAuthEnabled()) return 'test'
  return null
}
