// What a `?session=` value names, and where a `share-` one's ciphertext is
// read from. Apart from `sessionSharing.ts`, which encrypts and decrypts, so a
// page can request a shared session before that module has downloaded.
import { sha256, toBase64Url } from './crypto.ts'

/**
 * The kinds of `?session=` value, each written `<kind>-<payload>`: a session
 * uploaded behind the link (`share`), carried whole in it (`encoded`, `json`), a
 * session spec to build one from (`spec`), or one saved in this browser
 * (`local`).
 */
export const SESSION_PARAM_KINDS = [
  'share',
  'encoded',
  'json',
  'spec',
  'local',
] as const
export type SessionParamKind = (typeof SESSION_PARAM_KINDS)[number]

export const SHARE_PREFIX = 'share-'
export const ENCODED_PREFIX = 'encoded-'
export const JSON_PREFIX = 'json-'
export const SPEC_PREFIX = 'spec-'
/** @deprecated use `sessionParamKind(value) === 'local'` */
export const LOCAL_PREFIX = 'local-'

export function sessionParamKind(value: string): SessionParamKind | undefined {
  return SESSION_PARAM_KINDS.find(kind => value.startsWith(`${kind}-`))
}

/** The payload after a `?session=` value's kind, or the value itself without one */
export function sessionParamPayload(value: string) {
  const kind = sessionParamKind(value)
  return kind ? value.slice(kind.length + 1) : value
}

/**
 * Joins a configured `shareURL` with one of the share service's two endpoints.
 * A plain `${shareURL}share` silently produced `https://host/api/v1share` for
 * the (natural) configured value without a trailing slash, and the 404 that
 * followed read as "the share service is down". An empty shareURL is left
 * alone: web honors an explicit empty string as "resolve relative to the page".
 */
export function shareEndpoint(shareURL: string, path: 'share' | 'load') {
  return shareURL && !shareURL.endsWith('/')
    ? `${shareURL}/${path}`
    : `${shareURL}${path}`
}

// The key's length in a `share-` value, which is how a reader finds where a
// server-named id ends
export const SHARE_KEY_LENGTH = 16

// The id a session is offered to the share service under: a hash of the key, so
// a link holding only the key can find it
export async function shareIdForKey(key: string) {
  return toBase64Url(await sha256(`jbrowse-share-id:${key}`)).slice(0, 16)
}

// The key never reaches the server, so a link that lost it (a chat client that
// clipped the URL, a hand-edited link) fetches fine and then fails in the
// cipher, whose own message is "The operation failed for an
// operation-specific reason". These say what actually went wrong.
export function missingKeyError() {
  return new Error(
    'This shared session link has lost its key, the only thing that can decrypt it. A link cut short in transit arrives like this.',
  )
}

/**
 * Where the share service at `loadUrl` holds a `share-` value's ciphertext.
 * The link holds the key alone (`share-<key>`, stored under a hash of it),
 * after a server-named id (`share-<id><key>`), or, in the oldest shape, as
 * `&password=` beside the id.
 */
export async function sharedSessionUrl(
  loadUrl: string,
  value: string,
  password?: string,
) {
  const payload = sessionParamPayload(value)
  if (password === undefined ? payload.length < SHARE_KEY_LENGTH : !password) {
    throw missingKeyError()
  }
  const sessionId =
    password !== undefined
      ? payload
      : payload.slice(0, -SHARE_KEY_LENGTH) ||
        (await shareIdForKey(payload.slice(-SHARE_KEY_LENGTH)))
  return `${loadUrl}?sessionId=${encodeURIComponent(sessionId)}`
}

let prefetched: { url: string; response: Promise<Response> } | undefined

/**
 * Request a shared session's ciphertext ahead of the reader, which takes the
 * response in place of its own request when it asks for the same url
 */
export function prefetchSharedSession(url: string) {
  const response = fetch(url)
  response.catch(() => {})
  prefetched = { url, response }
}

/** The response {@link prefetchSharedSession} requested for `url`, once */
export function takePrefetchedSharedSession(url: string) {
  const entry = prefetched
  prefetched = undefined
  return entry?.url === url ? entry.response : undefined
}
