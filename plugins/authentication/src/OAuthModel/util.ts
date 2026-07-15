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
 * Parses an OAuth redirect message event. Returns the token if the event
 * completes the flow, undefined if the event name doesn't match. Throws on
 * any OAuth error.
 */
export async function finishOAuthWindow(
  event: MessageEvent,
  params: OAuthWindowParams,
): Promise<string | undefined> {
  if (event.data.name !== `JBrowseAuthWindow-${params.internetAccountId}`) {
    return undefined
  }
  const redirectUrl = new URL(event.data.redirectUri.replace('#', '?'))
  const urlParams = new URLSearchParams(redirectUrl.search)
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
 * Returns a promise that resolves to the token when the OAuth popup posts its
 * redirect back. The listener is self-contained and cleaned up when the
 * promise settles.
 */
export function waitForOAuthMessage(
  finish: (event: MessageEvent) => Promise<string | undefined>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const listener = async (event: MessageEvent) => {
      try {
        const token = await finish(event)
        if (token !== undefined) {
          window.removeEventListener('message', listener)
          resolve(token)
        }
      } catch (e) {
        window.removeEventListener('message', listener)
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    }
    window.addEventListener('message', listener)
  })
}
