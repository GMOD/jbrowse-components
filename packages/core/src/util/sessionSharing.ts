import { aesDecrypt, aesEncrypt } from './crypto.ts'

function bytesToBinaryString(bytes: Uint8Array) {
  return Array.from(bytes, b => String.fromCharCode(b)).join('')
}

// from https://stackoverflow.com/questions/1349404/
// crypto.getRandomValues is available in non-secure contexts per MDN,
// unlike crypto.subtle which requires HTTPS.
function generateUID(length: number) {
  return window
    .btoa(
      bytesToBinaryString(crypto.getRandomValues(new Uint8Array(length * 2))),
    )
    .replaceAll(/[+/]/g, '')
    .slice(0, length)
}

function getErrorMsg(err: string) {
  try {
    const obj = JSON.parse(err)
    return obj.message ?? err
  } catch {
    return err
  }
}

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

/**
 * Decode and inflate a url-safe base64 to a string
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 */
export async function fromUrlSafeB64(b64: string) {
  const originalB64 = b64PadSuffix(
    b64.replaceAll('-', '+').replaceAll('_', '/'),
  )
  const { inflate } = await import('pako-esm2')
  const bytes = Uint8Array.from(atob(originalB64), c => c.charCodeAt(0))
  const inflated = inflate(bytes, undefined)
  return new TextDecoder('utf8').decode(inflated)
}

/**
 * Compress and encode a string as url-safe base64
 * See {@link https://en.wikipedia.org/wiki/Base64#URL_applications}
 */
export async function toUrlSafeB64(str: string) {
  const bytes = new TextEncoder().encode(str)
  const { deflate } = await import('pako-esm2')
  const deflated = deflate(bytes, undefined)
  const encoded = btoa(bytesToBinaryString(deflated)).replace(/=+$/, '')
  return encoded.replaceAll('+', '-').replaceAll('/', '_')
}

/**
 * The `?session=` value prefixes, named here because this module is what
 * produces them. The decoder half (jbrowse-web's SessionLoader) has its own
 * list covering the two prefixes nothing here writes (`spec-`, `local-`).
 */
export const SHARE_PREFIX = 'share-'
export const ENCODED_PREFIX = 'encoded-'
export const JSON_PREFIX = 'json-'

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
  const password = generateUID(5)

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

export type SessionShareMode = 'short' | 'long' | 'json'

export interface EncodedSessionParam {
  // the `?session=` query value the web SessionLoader decodes
  sessionParam: string
  // present only for a short link
  password?: string
  // pretty-printed session, present only for json mode (shown in the dialog)
  plaintext?: string
}

// Encodes a session snapshot into the `?session=` value jbrowse-web decodes:
// `share-<id>` (uploaded + encrypted), `encoded-<b64>` (compressed inline), or
// `json-<json>` (plaintext inline). Single source of these prefixes, shared by
// jbrowse-web's ShareDialog and jbrowse-desktop's ExportToWebDialog so the two
// producers can't drift from the decoder.
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
  } else if (mode === 'json') {
    // compact in the link (this mode's URL is the longest of the three
    // already), indented in the dialog's readable-JSON panel
    return {
      sessionParam: `${JSON_PREFIX}${JSON.stringify({ session })}`,
      plaintext: JSON.stringify({ session }, null, 2),
    }
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
