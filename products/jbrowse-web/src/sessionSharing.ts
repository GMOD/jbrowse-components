import * as crypto from 'crypto'
import {
  toUrlSafeB64,
  fromUrlSafeUB64,
  toUrlSafeUB64,
} from '@jbrowse/core/util'

// adapted encrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
const encrypt = (text: string, key: Buffer, iv: Buffer) => {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return {
    iv: toUrlSafeUB64(iv.toString('base64')),
    encryptedData: toUrlSafeUB64(encrypted.toString('base64')),
  }
}

// adapted decrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
const decrypt = (text: string, key: Buffer, password: string) => {
  const iv = Buffer.from(fromUrlSafeUB64(password), 'base64')
  const encryptedText = Buffer.from(fromUrlSafeUB64(text), 'base64')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv)
  let decrypted = decipher.update(encryptedText)
  decrypted = Buffer.concat([decrypted, decipher.final()])
  return decrypted.toString()
}
// writes the encrypted session, current datetime, and referer to DynamoDB
export async function shareSessionToDynamo(
  session: Record<string, unknown>,
  url: string,
  referer: string,
) {
  const sess = `${toUrlSafeB64(JSON.stringify(session))}`
  const key = crypto.createHash('sha256').update('JBrowse').digest()
  const iv = crypto.randomBytes(16)
  const encryptedSession = encrypt(sess, key, iv)

  const data = new FormData()
  data.append('session', encryptedSession.encryptedData)
  data.append('dateShared', `${Date.now()}`)
  data.append('referer', referer)

  const response = await fetch(`${url}share`, {
    method: 'POST',
    mode: 'cors',
    body: data,
  })

  if (!response.ok) {
    throw new Error(`Error sharing session ${response.statusText}`)
  }
  const json = await response.json()
  return {
    json,
    encryptedSession,
  }
}

export async function readSessionFromDynamo(
  baseUrl: string,
  sessionQueryParam: string,
  key: Buffer,
  password: string,
  signal?: AbortSignal,
) {
  const sessionId = sessionQueryParam.split('share-')[1]
  const url = `${baseUrl}?sessionId=${sessionId}`

  const response = await fetch(url, {
    signal,
  })

  if (!response.ok) {
    console.error({ response, url })
    throw new Error(
      `Unable to fetch session ${sessionId}\n${response.statusText}`,
    )
  }

  // TODO: shouldn't get a 200 back for this
  const text = await response.text()
  if (!text) {
    throw new Error(`Unable to fetch session ${sessionId}`)
  }
  const json = JSON.parse(text)
  return decrypt(json.session, key, password)
}
