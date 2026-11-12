/**
 * Whether a browser request came from this site, or was typed into the
 * address bar or opened from a bookmark. Browsers set Sec-Fetch-Site on every
 * request to an HTTPS origin (and localhost) and pages can't forge it, so a
 * link or form on another site arrives as "cross-site" or "same-site".
 *
 * Used where the SameSite=Lax session cookie alone isn't enough: Lax still
 * sends the cookie on a top-level cross-site GET (a link to the manual
 * snapshot run) and on any cross-site POST to a route that needs no session
 * (sign-out). A request without the header is refused too: every browser that
 * can sign in here sends it, and nothing else needs these two routes.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  return site === 'same-origin' || site === 'none'
}
