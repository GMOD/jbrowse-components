export interface OAuthWindowParams {
  internetAccountId: string
  expectedState: string | undefined
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
  params: OAuthWindowParams,
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
  if (params.expectedState && urlParams.get('state') !== params.expectedState) {
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
 * reporting back, and undefined otherwise. Synchronous, so a caller can tell a
 * relevant message from an unrelated one before finishing it — finishing can
 * take a round trip of its own.
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

/**
 * Parses an OAuth redirect message event. Returns the token if the event
 * completes the flow, undefined if the event isn't this account's redirect.
 * Throws on any OAuth error.
 */
export async function finishOAuthWindow(
  event: MessageEvent,
  params: OAuthWindowParams,
): Promise<string | undefined> {
  const redirectUri = getOAuthRedirectUri(event, params.internetAccountId)
  return redirectUri === undefined
    ? undefined
    : finishOAuthRedirect(redirectUri, params)
}

// How often the popup is checked for having been closed, and how many
// consecutive closed readings it takes to call the flow cancelled.
const POLL_INTERVAL_MS = 500
const CLOSED_POLLS_TO_CANCEL = 2

/**
 * Returns a promise that resolves to the token when the OAuth popup posts its
 * redirect back. The listener is self-contained and cleaned up when the promise
 * settles.
 *
 * Given a `watch`, closing the popup without completing the flow rejects rather
 * than leaving the promise pending — and pending is not a benign state here,
 * because `getToken` caches this promise and hands it to every later request:
 * one dismissed login window left the account dead for the rest of the session,
 * showing nothing. Same failure the blocked-popup check in `getTokenViaAuthFlow`
 * covers, reached the other way.
 */
export function waitForOAuthMessage(
  finish: (event: MessageEvent) => Promise<string | undefined>,
  watch?: {
    popup: Pick<Window, 'closed'>
    /** whether an event is this popup's redirect, tested synchronously */
    isOwnMessage: (event: MessageEvent) => boolean
  },
): Promise<string> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setInterval> | undefined
    let finishing = false
    let closedPolls = 0
    const settle = (act: () => void) => {
      window.removeEventListener('message', listener)
      clearInterval(timer)
      act()
    }
    const listener = async (event: MessageEvent) => {
      const own = watch?.isOwnMessage(event) ?? false
      finishing ||= own
      try {
        const token = await finish(event)
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
      // a redirect of ours that completed nothing — a provider that came back
      // with neither token, code nor error. Hand the popup back to the
      // watchdog rather than latching it off for good.
      if (own) {
        finishing = false
      }
    }
    window.addEventListener('message', listener)

    if (watch) {
      timer = setInterval(() => {
        // A closed popup only means cancellation while no redirect of ours has
        // arrived: the popup posts and *then* closes itself, and the code flow
        // then spends a token exchange finishing. Hence both the `finishing`
        // latch and a poll of grace for the gap between the post and this
        // listener running.
        if (finishing || !watch.popup.closed) {
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
    }
  })
}
