// duplicated from products/jbrowse-web/src/sessionSharing.ts ; could possibly be moved into a higher directory and shared between the two
import { aesDecrypt, aesEncrypt } from '@jbrowse/core/util'

import { toUrlSafeB64 } from './utils.ts'

// from https://stackoverflow.com/questions/1349404/
function generateUID(length: number) {
  return window
    .btoa(
      [...window.crypto.getRandomValues(new Uint8Array(length * 2))]
        .map(b => String.fromCharCode(b))
        .join(''),
    )
    .replaceAll(/[+/]/g, '')
    .slice(0, length)
}

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
  session: unknown,
  url: string,
  referer: string,
) {
  const sess = await toUrlSafeB64(JSON.stringify(session))
  const password = generateUID(5)
  const encryptedSession = aesEncrypt(sess, password)

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
) {
  const sessionId = sessionQueryParam.split('share-')[1]!
  const url = `${baseUrl}?sessionId=${encodeURIComponent(sessionId)}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(getErrorMsg(await response.text()))
  }

  const json = await response.json()
  return aesDecrypt(json.session, password)
}
