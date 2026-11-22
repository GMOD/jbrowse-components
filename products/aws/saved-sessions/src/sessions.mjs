import { createHash } from 'node:crypto'

// DynamoDB refuses an item over 400 KB, and its message names no remedy
export const MAX_SESSION_LENGTH = 350_000

function reply(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) }
}

function kilobytes(length) {
  return `${Math.ceil(length / 1000)} KB`
}

function header(headers, name) {
  return Object.entries(headers ?? {}).find(
    ([key]) => key.toLowerCase() === name,
  )?.[1]
}

/** The fields of a multipart/form-data request, by name */
export function parseMultipart(event) {
  const boundary = header(event.headers, 'content-type')?.match(
    /boundary="?([^";]+)"?/,
  )?.[1]
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : (event.body ?? '')
  return Object.fromEntries(
    boundary
      ? body.split(`--${boundary}`).flatMap(part => {
          const split = part.indexOf('\r\n\r\n')
          const name = part.slice(0, split).match(/\bname="([^"]*)"/)?.[1]
          return split !== -1 && name
            ? [[name, part.slice(split + 4).replace(/\r\n$/, '')]]
            : []
        })
      : [],
  )
}

// The client offers a hash of the key its link carries, so the link needs only
// the key. Write-once storage keeps an offered id from replacing a session.
function offeredSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[\w-]{16,64}$/.test(sessionId)
    ? sessionId
    : undefined
}

// what a client that offers no id gets: a random one
function generatedSessionId(session) {
  return createHash('sha256')
    .update(session + Math.random())
    .digest('base64url')
    .slice(0, 10)
}

async function store(fields, putItem) {
  const sessionId =
    offeredSessionId(fields.sessionId) ?? generatedSessionId(fields.session)
  try {
    await putItem({
      sessionId: { S: sessionId },
      session: { S: fields.session },
      dateShared: { S: fields.dateShared ?? `${Date.now()}` },
      referer: { S: fields.referer ?? '' },
    })
    return reply(200, { sessionId })
  } catch (e) {
    return e?.name === 'ConditionalCheckFailedException'
      ? reply(409, { message: 'A session is already stored under that id' })
      : reply(500, { message: `${e}` })
  }
}

/**
 * Stores the encrypted session a share request carries, under the id the
 * client offers when it is well formed. `putItem` writes a DynamoDB item once,
 * rejecting with ConditionalCheckFailedException when the id is taken.
 */
export async function saveSession(event, putItem) {
  const fields = parseMultipart(event)
  const { session } = fields
  return !session
    ? reply(400, { message: 'The request holds no session to store' })
    : session.length > MAX_SESSION_LENGTH
      ? reply(413, {
          message: `This session is too large for a short link (${kilobytes(session.length)}, over the ${kilobytes(MAX_SESSION_LENGTH)} limit). A long link carries the session itself and needs no upload.`,
        })
      : store(fields, putItem)
}

/**
 * The stored session a load request names, every attribute as a string.
 * `getItem` resolves to the DynamoDB item, or undefined when there is none.
 */
export async function readSession(event, getItem) {
  // API Gateway hands a sessionId's '+' over as a space (#3524), and ids made
  // before generated ones were url-safe can hold one
  const sessionId = event.queryStringParameters?.sessionId?.replaceAll(' ', '+')
  try {
    const item = sessionId ? await getItem(sessionId) : undefined
    return item
      ? reply(
          200,
          Object.fromEntries(
            Object.entries(item).map(([key, value]) => [key, value.S]),
          ),
        )
      : reply(404, { message: 'Session not found' })
  } catch (e) {
    return reply(500, { message: `${e}` })
  }
}
