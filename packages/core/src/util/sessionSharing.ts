import { aesDecrypt, aesEncrypt } from './crypto.ts'

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
  const { toByteArray } = await import('base64-js')
  const { inflate } = await import('pako-esm2')
  const bytes = toByteArray(originalB64)
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
  const { fromByteArray } = await import('base64-js')
  const deflated = deflate(bytes, undefined)
  const encoded = fromByteArray(deflated)
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
  const json = await response.json()
  return { json, encryptedSession, password }
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
