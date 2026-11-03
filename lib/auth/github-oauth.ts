import 'server-only'
import { oauthErrorCode } from '@/lib/log'

/** Where GitHub sends the owner back; must match a callback URL on the OAuth App. */
export function callbackUrl(origin: string): string {
  return `${origin}/api/auth/callback`
}

export type CodeExchange =
  | { token: string }
  | { token: null; status: number; error?: string }

/**
 * Swaps the one-time code (plus the PKCE verifier) for a short-lived user token.
 * On failure it returns GitHub's HTTP status and short error code (such as
 * `bad_verification_code`), never the token or the error description.
 */
export async function exchangeCode(code: string, verifier: string, redirectUri: string): Promise<CodeExchange> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
    cache: 'no-store',
  })
  if (!response.ok) return { token: null, status: response.status }
  const body = (await response.json()) as { access_token?: unknown; error?: unknown }
  if (typeof body.access_token === 'string') return { token: body.access_token }
  return { token: null, status: response.status, error: oauthErrorCode(body.error) }
}

/** The account behind a user token, or the HTTP status GitHub answered with. */
export async function fetchGitHubUser(
  token: string,
): Promise<{ user: { id: number; login: string } } | { user: null; status: number }> {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    cache: 'no-store',
  })
  if (!response.ok) return { user: null, status: response.status }
  const body = (await response.json()) as { id?: unknown; login?: unknown }
  if (typeof body.id !== 'number' || typeof body.login !== 'string') return { user: null, status: response.status }
  return { user: { id: body.id, login: body.login } }
}

/**
 * The dashboard only needed the token to learn who signed in, so it revokes
 * it straight away (best effort): no usable GitHub token outlives sign-in.
 */
export async function revokeToken(token: string): Promise<void> {
  const id = process.env.GITHUB_OAUTH_CLIENT_ID
  const secret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!id || !secret) return
  try {
    await fetch(`https://api.github.com/applications/${id}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token: token }),
      cache: 'no-store',
    })
  } catch {
    // Revocation is a courtesy; the token also expires on its own.
  }
}
