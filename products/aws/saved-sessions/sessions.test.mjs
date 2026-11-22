import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  MAX_SESSION_LENGTH,
  parseMultipart,
  readSession,
  saveSession,
} from './src/sessions.mjs'

// a share request as the browser posts it, as API Gateway hands it over
async function shareEvent(fields) {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value)
  }
  const response = new Response(form)
  return {
    headers: { 'Content-Type': response.headers.get('content-type') },
    isBase64Encoded: true,
    body: Buffer.from(await response.arrayBuffer()).toString('base64'),
  }
}

const fields = {
  session: 'U2FsdGVkX1+abc/def==',
  dateShared: '1763690000000',
  referer: 'https://jbrowse.org/code/jb2/main/?config=a%20b.json',
  sessionId: 'abcdefghijklmnop',
}

test('the fields of a share request read back as sent', async () => {
  assert.deepEqual(parseMultipart(await shareEvent(fields)), fields)
})

test('a body API Gateway did not base64-encode reads the same', async () => {
  const event = await shareEvent(fields)
  assert.deepEqual(
    parseMultipart({
      ...event,
      isBase64Encoded: false,
      body: Buffer.from(event.body, 'base64').toString('utf8'),
    }),
    fields,
  )
})

test('a session is stored under the id the client offers', async () => {
  const items = []
  const response = await saveSession(await shareEvent(fields), async item => {
    items.push(item)
  })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(JSON.parse(response.body), { sessionId: 'abcdefghijklmnop' })
  assert.deepEqual(items, [
    {
      sessionId: { S: 'abcdefghijklmnop' },
      session: { S: fields.session },
      dateShared: { S: fields.dateShared },
      referer: { S: fields.referer },
    },
  ])
})

test('a client that offers no well-formed id is given a url-safe one', async () => {
  for (const sessionId of [undefined, 'short', 'has/slash/and+plus!']) {
    const { sessionId: _, ...rest } = fields
    const event = await shareEvent(sessionId ? { ...rest, sessionId } : rest)
    const response = await saveSession(event, async () => {})
    assert.match(JSON.parse(response.body).sessionId, /^[\w-]{10}$/)
  }
})

test('an id already taken is refused, not overwritten', async () => {
  const response = await saveSession(await shareEvent(fields), async () => {
    const e = new Error('The conditional request failed')
    e.name = 'ConditionalCheckFailedException'
    throw e
  })
  assert.equal(response.statusCode, 409)
  assert.match(JSON.parse(response.body).message, /already stored/)
})

test('a session too large to store points at a long link, and writes nothing', async () => {
  let wrote = false
  const response = await saveSession(
    await shareEvent({
      ...fields,
      session: 'a'.repeat(MAX_SESSION_LENGTH + 1),
    }),
    async () => {
      wrote = true
    },
  )
  assert.equal(response.statusCode, 413)
  assert.match(JSON.parse(response.body).message, /A long link carries/)
  assert.equal(wrote, false)
})

test('a request with no session is refused', async () => {
  const { session: _, ...rest } = fields
  const response = await saveSession(await shareEvent(rest), async () => {})
  assert.equal(response.statusCode, 400)
})

const stored = {
  sessionId: { S: 'ab+cd' },
  session: { S: 'U2FsdGVkX1' },
  dateShared: { S: '1' },
  referer: { S: 'https://jbrowse.org/' },
}

test('a stored session reads back with every attribute as a string', async () => {
  const asked = []
  const response = await readSession(
    { queryStringParameters: { sessionId: 'ab cd' } },
    async id => {
      asked.push(id)
      return stored
    },
  )
  assert.deepEqual(asked, ['ab+cd'])
  assert.equal(response.statusCode, 200)
  assert.deepEqual(JSON.parse(response.body), {
    sessionId: 'ab+cd',
    session: 'U2FsdGVkX1',
    dateShared: '1',
    referer: 'https://jbrowse.org/',
  })
})

test('an id with nothing stored, or no id at all, is a 404', async () => {
  for (const event of [
    { queryStringParameters: { sessionId: 'missing' } },
    { queryStringParameters: null },
  ]) {
    const response = await readSession(event, async () => undefined)
    assert.equal(response.statusCode, 404)
  }
})
