import { getRoot } from '@jbrowse/mobx-state-tree'

import type { DialogHost } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The session an account queues its credential dialogs on, if the root has
 * one. Accounts live on the root model beside the session rather than under
 * it, so `getSession` cannot reach it, and an embedded root need not have one.
 */
export function getAccountSession(account: IAnyStateTreeNode) {
  const { session } = getRoot<{ session?: Partial<DialogHost> }>(account)
  return typeof session?.queueDialog === 'function'
    ? (session as DialogHost)
    : undefined
}

export async function getResponseError({
  response,
  reason,
  statusText,
}: {
  response: Response
  reason?: string
  statusText?: string
}) {
  return [
    `HTTP ${response.status}`,
    reason,
    statusText ?? (await getError(response)),
  ]
    .filter(Boolean)
    .join(' - ')
}

export async function getError(response: Response) {
  try {
    return await response.text()
  } catch {
    return response.statusText
  }
}

/**
 * Proves a token by issuing `probe` with it, and returns the token that
 * worked. Only a 401 condemns the credential (RFC 6750 §3.1): the account
 * drops it, and `renew` may mint one replacement, proven once and stored if the
 * server accepts it. Any other failure, such as a missing file, a rate limit or
 * a server refusing HEAD, throws and keeps the credential, so the next read
 * does not ask the user to log in again.
 */
export async function proveToken({
  account,
  token,
  probe,
  describeError,
  renew,
}: {
  account: { removeToken: () => void; storeToken: (token: string) => void }
  token: string
  probe: (token: string) => Promise<Response>
  describeError: (response: Response, reason?: string) => Promise<string>
  renew?: () => Promise<string | undefined>
}) {
  const response = await probe(token)
  if (response.status !== 401) {
    if (!response.ok) {
      throw new Error(await describeError(response))
    }
    return token
  }
  account.removeToken()
  const renewed = await renew?.()
  if (renewed === undefined) {
    throw new Error(await describeError(response, 'Error validating token'))
  }
  const retry = await probe(renewed)
  if (retry.status === 401) {
    throw new Error(await describeError(retry, 'Error validating token'))
  }
  account.storeToken(renewed)
  if (!retry.ok) {
    throw new Error(await describeError(retry))
  }
  return renewed
}

/**
 * Builds the `describeError` a provider hands `validateTokenWithProbe` and
 * throws from its fetcher: read the body, pull the human-readable part out of
 * the provider's own error JSON, and fall back to the raw text when it is not
 * that shape at all — an HTML error page from a proxy in front of the API, say.
 *
 * `extract` runs inside the same guard as the parse, so it may reach into the
 * payload without checking each hop.
 */
export function descriptiveErrorMessage<T>(
  extract: (parsed: T) => string | undefined,
) {
  return async (response: Response, reason?: string) => {
    const text = await response.text()
    let statusText = text
    try {
      statusText = extract(JSON.parse(text) as T) ?? text
    } catch {
      // statusText stays as raw response text
    }
    return getResponseError({ response, reason, statusText })
  }
}
