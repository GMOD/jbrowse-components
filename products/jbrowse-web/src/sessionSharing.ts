import { toUrlSafeB64 } from '@jbrowse/core/util'

import AES from 'crypto-js/aes'
import Utf8 from 'crypto-js/enc-utf8'

// from https://stackoverflow.com/questions/1349404/
function generateUID(length: number) {
  return window
    .btoa(
      Array.from(window.crypto.getRandomValues(new Uint8Array(length * 2)))
        .map(b => String.fromCharCode(b))
        .join(''),
    )
    .replace(/[+/]/g, '')
    .substring(0, length)
}

const encrypt = (text: string, password: string) => {
  return AES.encrypt(text, password).toString()
}

const decrypt = (text: string, password: string) => {
  const bytes = AES.decrypt(text, password)
  return bytes.toString(Utf8)
}

// recusively checks config for callbacks and removes them
// was used to parse and delete, commented out for later if needed
// const deleteCallbacks = (key: any) => {
//   if (Array.isArray(key)) {
//     key.forEach(a => {
//       deleteCallbacks(a)
//     })
//   } else if (key && typeof key === 'object') {
//     Object.entries(key).forEach(([innerKey, value]) => {
//       if (typeof value === 'string' && value.startsWith('function')) {
//         delete key[innerKey] // removing sets it to the default callback
//       } else deleteCallbacks(key[innerKey])
//     })
//   }
// }

function getErrorMsg(err: string) {
  try {
    const obj = JSON.parse(err)
    return obj.message
  } catch (e) {
    return err
  }
}
// writes the encrypted session, current datetime, and referer to DynamoDB
export async function shareSessionToDynamo(
  session: Record<string, unknown>,
  url: string,
  referer: string,
) {
  const sess = `${toUrlSafeB64(JSON.stringify(session))}`
  const password = generateUID(5)
  const encryptedSession = encrypt(sess, password)

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
    const err = await response.text()
    throw new Error(getErrorMsg(err))
  }
  const json = await response.json()
  return {
    json,
    encryptedSession,
    password,
  }
}

export async function readSessionFromDynamo(
  baseUrl: string,
  sessionQueryParam: string,
  password: string,
  signal?: AbortSignal,
) {
  const sessionId = sessionQueryParam.split('share-')[1]
  const url = `${baseUrl}?sessionId=${sessionId}`

  const response = await fetch(url, {
    signal,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(getErrorMsg(err))
  }

  const json = await response.json()
  return decrypt(json.session, password)
}
