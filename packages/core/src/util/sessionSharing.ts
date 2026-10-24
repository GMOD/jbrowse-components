import { aesDecrypt, aesEncrypt, base64Decode, toBase64Url } from './crypto.ts'

function getErrorMsg(err: string) {
  try {
    const obj = JSON.parse(err)
    return obj.message ?? err
  } catch {
    return err
  }
}

/**
 * @deprecated `atob` accepts unpadded base64, so nothing in JBrowse pads any
 * more; kept because `@jbrowse/core/util` exports it
 */
export function b64PadSuffix(b64: string): string {
  let num: number
  const mo = b64.length % 4
  switch (mo) {
    case 3:
      num = 1
      break
    case 2:
      num = 2
      break
    case 0:
      num = 0
      break
    default:
      throw new Error('Illegal base64url string!')
  }
  return b64 + '='.repeat(num)
}

async function transformBytes(
  bytes: Uint8Array<ArrayBuffer>,
  transform: CompressionStream | DecompressionStream,
) {
  const stream = new Response(bytes).body!.pipeThrough(transform)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Decode and inflate a url-safe base64 to a string
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 *
 * A truncated input rejects rather than inflating to a prefix: a link cut short
 * in transit has to say so, not fail later as a JSON syntax error.
 */
export async function fromUrlSafeB64(b64: string) {
  try {
    const bytes = base64Decode(b64.replaceAll('-', '+').replaceAll('_', '/'))
    return new TextDecoder().decode(
      await transformBytes(bytes, new DecompressionStream('deflate')),
    )
  } catch (e) {
    throw new Error(
      'This session is incomplete or damaged, which is how a link cut short in transit arrives. A short link survives being sent where a long one may not.',
      { cause: e },
    )
  }
}

/**
 * Compress and encode a string as url-safe base64
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 */
export async function toUrlSafeB64(str: string) {
  return toBase64Url(
    await transformBytes(
      new TextEncoder().encode(str),
      new CompressionStream('deflate'),
    ),
  )
}

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

/**
 * writes the encrypted session, current datetime, and referer to DynamoDB
 */
async function shareSessionToDynamo(
  session: unknown,
  shareURL: string,
  referer: string,
) {
  const sess = await toUrlSafeB64(JSON.stringify(session))
  // the server returns the ciphertext to anyone holding the session id, so the
  // password alone guards it: 16 base64url characters, 96 bits
  const password = toBase64Url(crypto.getRandomValues(new Uint8Array(12)))

  const data = new FormData()
  data.append('session', await aesEncrypt(sess, password))
  data.append('dateShared', `${Date.now()}`)
  data.append('referer', referer)

  const response = await fetch(shareEndpoint(shareURL, 'share'), {
    method: 'POST',
    mode: 'cors',
    body: data,
  })

  if (!response.ok) {
    throw new Error(getErrorMsg(await response.text()))
  }
  const { sessionId } = (await response.json()) as { sessionId: string }
  return { sessionId, password }
}

export type SessionShareMode = 'short' | 'long'

export interface EncodedSessionParam {
  // the `?session=` query value the web SessionLoader decodes
  sessionParam: string
  // present only for a short link
  password?: string
}

// Encodes a session snapshot into the `?session=` value jbrowse-web decodes:
// `share-<id>` (uploaded + encrypted) or `encoded-<b64>` (compressed inline).
// Single source of these prefixes, shared by jbrowse-web's ShareDialog and
// jbrowse-desktop's ExportToWebDialog so the two producers can't drift from the
// decoder. The decoder also reads `json-{"session":…}`, which nothing here
// writes: it is the form a person writes by hand.
export async function encodeSessionParam(
  mode: SessionShareMode,
  session: unknown,
  options: { shareURL: string; referer: string },
): Promise<EncodedSessionParam> {
  if (mode === 'short') {
    const { sessionId, password } = await shareSessionToDynamo(
      session,
      options.shareURL,
      options.referer,
    )
    return { sessionParam: `${SHARE_PREFIX}${sessionId}`, password }
  } else {
    const encoded = await toUrlSafeB64(JSON.stringify(session))
    return { sessionParam: `${ENCODED_PREFIX}${encoded}` }
  }
}

export async function readSessionFromDynamo(
  loadUrl: string,
  sessionQueryParam: string,
  password: string,
  signal?: AbortSignal,
) {
  const sessionId = sessionQueryParam.startsWith(SHARE_PREFIX)
    ? sessionQueryParam.slice(SHARE_PREFIX.length)
    : sessionQueryParam
  // The password never reaches the server — it lives only in the link — so a
  // link that lost its `&password=` (a chat client that clipped the URL, a
  // hand-edited link) fetches fine and then fails in the cipher, where the
  // browser's message is "The operation failed for an operation-specific
  // reason". Say what actually went wrong instead.
  if (!password) {
    throw new Error(
      'This shared session link is missing its "password" URL parameter, which is the only thing that can decrypt it',
    )
  }
  const url = `${loadUrl}?sessionId=${encodeURIComponent(sessionId)}`
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(getErrorMsg(await response.text()))
  }

  const json = (await response.json()) as { session?: string }
  if (typeof json.session !== 'string') {
    throw new Error(
      'Shared session not found — the link may have expired or the id is wrong',
    )
  }
  try {
    return await aesDecrypt(json.session, password)
  } catch (e) {
    throw new Error(
      'Could not decrypt the shared session — the "password" in the link is wrong or the link was truncated',
      { cause: e },
    )
  }
}
