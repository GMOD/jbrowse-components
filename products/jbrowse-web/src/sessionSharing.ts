import { toUrlSafeB64 } from '@jbrowse/core/util'

const AES = require('crypto-js/aes')
const Utf8 = require('crypto-js/enc-utf8')

// adapted encrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
const encrypt = (text: string, password: string) => {
  const encrypted = AES.encrypt(text, password).toString()
  return encrypted
}

// from https://stackoverflow.com/questions/1349404/generate-random-string-characters-in-javascript
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

// adapted decrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
const decrypt = (text: string, password: string) => {
  // const iv = Buffer.from(password, 'hex')
  // const encryptedText = Buffer.from(text, 'hex')
  // const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv)
  // let decrypted = decipher.update(encryptedText)
  // decrypted = Buffer.concat([decrypted, decipher.final()])
  // AES.decrypt(ciphertext, 'secret key 123');
  const bytes = AES.decrypt(text, password)
  console.log({ bytes })
  return bytes.toString(Utf8)
  // return new TextDecoder('utf8').decode(bytes)
  // return bytes.toString(enc.Utf8)
  // return decrypted.toString()
}
// writes the encrypted session, current datetime, and referer to DynamoDB
export async function shareSessionToDynamo(
  session: Record<string, unknown>,
  url: string,
  referer: string,
) {
  const sess = `${toUrlSafeB64(JSON.stringify(session))}`
  // const password = crypto.randomBytes(16).toString()
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
    throw new Error(`Error sharing session ${response.statusText}`)
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
  return decrypt(json.session, password)
}
