export interface OAuthRedirectParams {
  expectedState: string
  exchangeAuthorizationCode: (
    code: string,
    redirectUri: string,
  ) => Promise<string>
  storeToken: (token: string) => void
}

export function parseOAuthError(text: string) {
  try {
    const { error, error_description } = JSON.parse(text) as {
      error?: string
      error_description?: string
    }
    return {
      isInvalidGrant: error === 'invalid_grant',
      statusText: error_description ?? text,
    }
  } catch {
    return { isInvalidGrant: false, statusText: text }
  }
}

/**
 * Completes the flow from the URL the provider redirected back to. Returns the
 * token, or undefined if the redirect carries neither a token, a code, nor an
 * error. Throws on any OAuth error.
 */
export async function finishOAuthRedirect(
  redirectUri: string,
  params: OAuthRedirectParams,
): Promise<string | undefined> {
  const redirectUrl = new URL(redirectUri)
  // Both halves: the code flow answers in the query string, the implicit flow
  // in the fragment. Read as a union rather than by rewriting the '#' into a
  // '?', which produced a second '?' — and so one unsplittable parameter — for
  // any redirect that carried both.
  const urlParams = new URLSearchParams(redirectUrl.search)
  for (const [key, value] of new URLSearchParams(
    redirectUrl.hash.replace('#', ''),
  )) {
    if (!urlParams.has(key)) {
      urlParams.set(key, value)
    }
  }
  if (urlParams.get('state') !== params.expectedState) {
    throw new Error('OAuth state mismatch — possible CSRF attack')
  }
  const accessToken = urlParams.get('access_token')
  if (accessToken) {
    params.storeToken(accessToken)
    return accessToken
  }
  const code = urlParams.get('code')
  if (code) {
    const token = await params.exchangeAuthorizationCode(
      code,
      redirectUrl.origin + redirectUrl.pathname,
    )
    params.storeToken(token)
    return token
  }
  const error = urlParams.get('error')
  if (error === 'access_denied') {
    throw new Error('OAuth flow was cancelled')
  }
  if (error) {
    throw new Error(`OAuth flow error: ${error}`)
  }
  return undefined
}

/**
 * The redirect URI a message event carries, if it is this account's popup
 * reporting back, and undefined otherwise.
 */
export function getOAuthRedirectUri(
  event: MessageEvent,
  internetAccountId: string,
): string | undefined {
  // The popup redirects back to our own origin and posts from there
  // (`initAuthWindow`), so anything else is another page talking to us — and
  // its `redirectUri` would inject that page's access token as ours.
  if (event.origin !== window.location.origin) {
    return undefined
  }
  // The window receives messages from anything holding a handle to it, of any
  // shape. Reading through an unchecked `event.data` throws a TypeError, and
  // the listener in waitForOAuthMessage turns a throw into a *rejected* auth
  // flow — so an unrelated `postMessage(null)` used to fail the login.
  const data: unknown = event.data
  if (
    typeof data !== 'object' ||
    data === null ||
    !('name' in data) ||
    !('redirectUri' in data)
  ) {
    return undefined
  }
  const { name, redirectUri } = data
  return name === `JBrowseAuthWindow-${internetAccountId}` &&
    typeof redirectUri === 'string'
    ? redirectUri
    : undefined
}

// How often the popup is checked for having been closed, and how many
// consecutive closed readings it takes to call the flow cancelled.
const POLL_INTERVAL_MS = 500
const CLOSED_POLLS_TO_CANCEL = 2

/**
 * Resolves to the token once this account's popup posts back a redirect that
 * `finish` completes, and rejects if `finish` throws or the popup closes with
 * no redirect in hand. Messages from anything else are ignored. The listener
 * and the poll both go when the promise settles.
 *
 * Pending is not a safe state to leave this promise in: `getToken` caches it
 * and hands it to every later request, so a dismissed login window that never
 * rejected would leave the account dead, showing nothing, for the rest of the
 * session.
 */
export function waitForOAuthMessage({
  popup,
  internetAccountId,
  finish,
}: {
  popup: Pick<Window, 'closed'>
  internetAccountId: string
  finish: (redirectUri: string) => Promise<string | undefined>
}): Promise<string> {
  return new Promise((resolve, reject) => {
    let finishing = false
    let closedPolls = 0
    const settle = (act: () => void) => {
      window.removeEventListener('message', listener)
      clearInterval(timer)
      act()
    }
    const listener = async (event: MessageEvent) => {
      const redirectUri = getOAuthRedirectUri(event, internetAccountId)
      if (redirectUri === undefined) {
        return
      }
      finishing = true
      try {
        const token = await finish(redirectUri)
        if (token !== undefined) {
          settle(() => {
            resolve(token)
          })
          return
        }
      } catch (e) {
        settle(() => {
          reject(e instanceof Error ? e : new Error(String(e)))
        })
        return
      }
      // a provider that came back with neither token, code nor error: hand
      // the popup back to the watchdog
      finishing = false
    }
    window.addEventListener('message', listener)

    // A closed popup only means cancellation while no redirect of ours is
    // being finished: the popup posts and *then* closes itself, and the code
    // flow spends a token exchange finishing. Hence both the `finishing` latch
    // and a poll of grace for the gap between the post and the listener
    // running.
    const timer = setInterval(() => {
      if (finishing || !popup.closed) {
        closedPolls = 0
        return
      }
      closedPolls += 1
      if (closedPolls >= CLOSED_POLLS_TO_CANCEL) {
        settle(() => {
          reject(new Error('OAuth flow was cancelled'))
        })
      }
    }, POLL_INTERVAL_MS)
  })
}
