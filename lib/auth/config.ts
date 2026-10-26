/**
 * The one account this dashboard admits: the owner's numeric GitHub user ID
 * (`gh api user --jq .id`). A numeric ID, not the login, because a login can
 * be renamed and then claimed by someone else; the ID never changes.
 * It is not a secret, and keeping it in code (not an env var) means a missing
 * or mistyped variable can never open the dashboard to another account.
 */
export const OWNER_GITHUB_ID = 8055935
export const OWNER_LOGIN = 'n8watkins'

/**
 * `__Host-` cookies must be Secure, Path=/ and have no Domain, so the browser
 * never sends them to another subdomain of n8builds.dev or over plain HTTP
 * (localhost counts as secure in Chrome and Firefox, so local sign-in works).
 */
export const SESSION_COOKIE = '__Host-n8admin_session'
export const OAUTH_COOKIE = '__Host-n8admin_oauth'

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
export const OAUTH_TTL_SECONDS = 10 * 60

export const JWT_ISSUER = 'admin.n8builds.dev'
export const SESSION_AUDIENCE = 'n8builds-admin:session'
export const OAUTH_AUDIENCE = 'n8builds-admin:oauth'
