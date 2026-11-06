import { aesDecrypt, aesDecryptBytes, aesEncryptBytes } from './aes.ts'
import { base64Decode, toBase64Url } from './crypto.ts'
import {
  ENCODED_PREFIX,
  SHARE_KEY_LENGTH,
  SHARE_PREFIX,
  sessionParamPayload,
  shareEndpoint,
  shareIdForKey,
  sharedSessionUrl,
  takePrefetchedSharedSession,
} from './sessionParam.ts'

export {
  ENCODED_PREFIX,
  JSON_PREFIX,
  LOCAL_PREFIX,
  SESSION_PARAM_KINDS,
  SHARE_PREFIX,
  SPEC_PREFIX,
  sessionParamKind,
  sessionParamPayload,
  shareEndpoint,
} from './sessionParam.ts'
export type { SessionParamKind } from './sessionParam.ts'

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

function deflate(str: string) {
  return transformBytes(
    new TextEncoder().encode(str),
    new CompressionStream('deflate'),
  )
}

// A truncated input rejects rather than inflating to a prefix: a link cut short
// in transit has to say so, not fail later as a JSON syntax error.
async function inflate(read: () => Uint8Array<ArrayBuffer>) {
  try {
    return new TextDecoder().decode(
      await transformBytes(read(), new DecompressionStream('deflate')),
    )
  } catch (e) {
    throw new Error(
      'This session is incomplete or damaged, which is how a link cut short in transit arrives. A short link survives being sent where a long one may not.',
      { cause: e },
    )
  }
}

/**
 * Decode and inflate a url-safe base64 to a string
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 */
export async function fromUrlSafeB64(b64: string) {
  return inflate(() =>
    base64Decode(b64.replaceAll('-', '+').replaceAll('_', '/')),
  )
}

/**
 * Compress and encode a string as url-safe base64
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 */
export async function toUrlSafeB64(str: string) {
  return toBase64Url(await deflate(str))
}

/**
 * writes the encrypted session, current datetime, and referer to DynamoDB
 */
async function shareSessionToDynamo(
  session: unknown,
  shareURL: string,
  referer: string,
) {
  // the server returns the ciphertext to anyone holding the session id, so the
  // key alone guards it: 96 bits, in SHARE_KEY_LENGTH base64url characters
  const key = toBase64Url(crypto.getRandomValues(new Uint8Array(12)))
  const offeredId = await shareIdForKey(key)

  const data = new FormData()
  data.append(
    'session',
    await aesEncryptBytes(await deflate(JSON.stringify(session)), key),
  )
  data.append('dateShared', `${Date.now()}`)
  data.append('referer', referer)
  data.append('sessionId', offeredId)

  const response = await fetch(shareEndpoint(shareURL, 'share'), {
    method: 'POST',
    mode: 'cors',
    body: data,
  })

  if (!response.ok) {
    throw new Error(getErrorMsg(await response.text()))
  }
  const { sessionId } = (await response.json()) as { sessionId: string }
  // a service that names its own id (any deployed before it took offers) puts
  // it in the link, ahead of the key
  return { key, sessionId: sessionId === offeredId ? '' : sessionId }
}

export type SessionShareMode = 'short' | 'long'

export interface EncodedSessionParam {
  // the `?session=` query value the web SessionLoader decodes
  sessionParam: string
}

// Encodes a session snapshot into the `?session=` value jbrowse-web decodes:
// `share-<key>` or `share-<id><key>` (uploaded + encrypted) or `encoded-<b64>` (compressed
// inline). Single source of these prefixes, shared by jbrowse-web's ShareDialog
// and jbrowse-desktop's ExportToWebDialog so the two producers can't drift from
// the decoder. The decoder also reads `json-{"session":…}`, which nothing here
// writes: it is the form a person writes by hand.
export async function encodeSessionParam(
  mode: SessionShareMode,
  session: unknown,
  options: { shareURL: string; referer: string },
): Promise<EncodedSessionParam> {
  if (mode === 'short') {
    const { sessionId, key } = await shareSessionToDynamo(
      session,
      options.shareURL,
      options.referer,
    )
    return { sessionParam: `${SHARE_PREFIX}${sessionId}${key}` }
  } else {
    const encoded = await toUrlSafeB64(JSON.stringify(session))
    return { sessionParam: `${ENCODED_PREFIX}${encoded}` }
  }
}

async function fetchCiphertext(url: string, signal?: AbortSignal) {
  const response = await (takePrefetchedSharedSession(url) ??
    fetch(url, { signal }))
  if (!response.ok) {
    throw new Error(getErrorMsg(await response.text()))
  }
  const json = (await response.json()) as { session?: string }
  if (typeof json.session !== 'string') {
    throw new Error(
      'Shared session not found — the link may be cut short, or have expired',
    )
  }
  return json.session
}

async function decrypt<T>(run: () => Promise<T>) {
  try {
    return await run()
  } catch (e) {
    throw new Error(
      'Could not decrypt the shared session — the key in the link is wrong or the link was truncated',
      { cause: e },
    )
  }
}

/**
 * The decrypted session of a link in the older shape, `share-<id>` beside
 * `&password=<key>`: the deflated session as url-safe base64, which
 * {@link fromUrlSafeB64} reads. {@link readSharedSession} reads either shape.
 */
export async function readSessionFromDynamo(
  loadUrl: string,
  sessionQueryParam: string,
  password: string,
  signal?: AbortSignal,
) {
  const ciphertext = await fetchCiphertext(
    await sharedSessionUrl(loadUrl, sessionQueryParam, password),
    signal,
  )
  return decrypt(() => aesDecrypt(ciphertext, password))
}

/**
 * The session JSON a `share-` value names. The link holds the key alone
 * (`share-<key>`, stored under a hash of it), after a server-named id
 * (`share-<id><key>`), or, in the oldest shape, as `&password=`. Only the id
 * goes to the share service, and the session is decrypted here.
 */
export async function readSharedSession(
  loadUrl: string,
  value: string,
  password?: string,
  signal?: AbortSignal,
) {
  if (password !== undefined) {
    return fromUrlSafeB64(
      await readSessionFromDynamo(loadUrl, value, password, signal),
    )
  }
  const ciphertext = await fetchCiphertext(
    await sharedSessionUrl(loadUrl, value),
    signal,
  )
  const key = sessionParamPayload(value).slice(-SHARE_KEY_LENGTH)
  const bytes = await decrypt(() => aesDecryptBytes(ciphertext, key))
  // a wrong key yields valid padding about once in 256 tries, and then garbage
  return decrypt(() => inflate(() => bytes))
}
