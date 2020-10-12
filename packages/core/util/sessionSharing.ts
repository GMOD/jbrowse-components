/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from 'crypto'
import { getSnapshot } from 'mobx-state-tree'
import { toUrlSafeB64 } from '.'

// adapted encrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
const encrypt = (text: string, key: Buffer, iv: Buffer) => {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return { iv: iv.toString('hex'), encryptedData: encrypted.toString('hex') }
}

// adapted decrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
const decrypt = (text: string, key: Buffer, password: string) => {
  if (!password) return null
  try {
    const iv = Buffer.from(password, 'hex')
    const encryptedText = Buffer.from(text, 'hex')
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(key),
      iv,
    )
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  } catch (e) {
    // error
    return null
  }
}
// writes the encrypted session, current datetime, and referer to DynamoDB
export async function shareSessionToDynamo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any,
  url: string,
  referer: string,
) {
  const sess = `${toUrlSafeB64(JSON.stringify(getSnapshot(session)))}`
  const key = crypto.createHash('sha256').update('JBrowse').digest()
  const iv = crypto.randomBytes(16)
  const encryptedSession = encrypt(sess, key, iv)

  const data = new FormData()
  data.append('session', encryptedSession.encryptedData)
  data.append('dateShared', `${Date.now()}`)
  data.append('referer', referer)

  let response
  try {
    response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      body: data,
    })
  } catch (error) {
    // ignore
  }

  if (response && response.ok) {
    const json = await response.json()
    return {
      json,
      encryptedSession,
    }
  }
  return null
}

export async function readSessionFromDynamo(
  sessionQueryParam: string,
  key: Buffer,
  password: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signal: any,
) {
  const sessionId = sessionQueryParam.split('share-')[1]
  const url = new URL(
    'https://g5um1mrb0i.execute-api.us-east-1.amazonaws.com/api/v1/load',
  )
  const params = new URLSearchParams(url.search)
  params.set('sessionId', sessionId)
  url.search = params.toString()

  let response
  try {
    response = await fetch(url.href, {
      method: 'GET',
      mode: 'cors',
      signal,
    })
  } catch (error) {
    if (!signal.aborted) {
      // ignore
    }
  }

  if (response && response.ok) {
    const json = await response.json()
    return decrypt(json.session, key, password)
  }

  return null
}
