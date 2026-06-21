import { aesDecrypt, aesEncrypt } from './crypto.ts'

function bytesToBinaryString(bytes: Uint8Array) {
  let str = ''
  for (const b of bytes) {
    str += String.fromCharCode(b)
  }
  return str
}

// from https://stackoverflow.com/questions/1349404/
// crypto.getRandomValues is available in non-secure contexts per MDN,
// unlike crypto.subtle which requires HTTPS.
function generateUID(length: number) {
  return window
    .btoa(
      [...crypto.getRandomValues(new Uint8Array(length * 2))]
        .map(b => String.fromCharCode(b))
        .join(''),
    )
    .replaceAll(/[+/]/g, '')
    .slice(0, length)
}

function getErrorMsg(err: string) {
  try {
    const obj = JSON.parse(err)
    return obj.message ?? err
  } catch (e) {
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
  const encoded = btoa(bytesToBinaryString(deflated))
  const pos = encoded.indexOf('=')
  return pos > 0
    ? encoded.slice(0, pos).replaceAll('+', '-').replaceAll('/', '_')
    : encoded.replaceAll('+', '-').replaceAll('/', '_')
}

/**
 * writes the encrypted session, current datetime, and referer to DynamoDB
 */
export async function shareSessionToDynamo(
  session: unknown,
  url: string,
  referer: string,
) {
  const sess = await toUrlSafeB64(JSON.stringify(session))
  const password = generateUID(5)
  const encryptedSession = await aesEncrypt(sess, password)

  const data = new FormData()
  data.append('session', encryptedSession)
  data.append('dateShared', `${Date.now()}`)
  data.append('referer', referer)

  const response = await fetch(`${url}share`, {
    method: 'POST',
    mode: 'cors',
    body: data,
  })

  if (!response.ok) {
    throw new Error(getErrorMsg(await response.text()))
  }
  const json = (await response.json()) as { sessionId: string }
  return { json, encryptedSession, password }
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
    const { json, password } = await shareSessionToDynamo(
      session,
      options.shareURL,
      options.referer,
    )
    return { sessionParam: `share-${json.sessionId}`, password }
  } else if (mode === 'json') {
    return {
      sessionParam: `json-${JSON.stringify({ session })}`,
      plaintext: JSON.stringify({ session }, null, 2),
    }
  } else {
    const encoded = await toUrlSafeB64(JSON.stringify(session))
    return { sessionParam: `encoded-${encoded}` }
  }
}

export async function readSessionFromDynamo(
  baseUrl: string,
  sessionQueryParam: string,
  password: string,
  signal?: AbortSignal,
) {
  const sessionId = sessionQueryParam.slice('share-'.length)
  const url = `${baseUrl}?sessionId=${encodeURIComponent(sessionId)}`
  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(getErrorMsg(await response.text()))
  }

  const json = await response.json()
  return aesDecrypt(json.session, password)
}
