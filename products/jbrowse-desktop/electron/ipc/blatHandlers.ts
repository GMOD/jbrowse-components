import { blatSession, parseBlatUrl } from '../blatSession.ts'
import { createChallengeWindow } from '../window.ts'
import { ipcHandle } from './channels.ts'

// hgBlat is slow for a long query, and nothing in this path can be cancelled:
// the dialog's Cancel closes the UI and leaves the POST running in main with
// nowhere to land. The timeout is what ends it.
const BLAT_TIMEOUT_MS = 120_000

// A BLAT answer is a PSL table or a kent error page, both small. The cap is so
// that a server the user pointed at — or one it redirected to — cannot make the
// main process hold an unbounded body in memory.
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024

// Reads a response body a chunk at a time and stops at `limit`, rather than
// `response.text()`, which commits to whatever the server sends.
async function readCapped(body: ReadableStream<Uint8Array> | null) {
  if (!body) {
    return ''
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      total += value.length
      if (total > MAX_RESPONSE_BYTES) {
        throw new Error(
          `BLAT response exceeded ${MAX_RESPONSE_BYTES} bytes and was discarded`,
        )
      }
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function registerBlatHandlers() {
  // async so a refused url rejects rather than throwing synchronously, matching
  // blatFetch and what the renderer sees across ipcMain either way
  ipcHandle('openBlatChallenge', async (_, url) =>
    createChallengeWindow(parseBlatUrl(url).href),
  )

  ipcHandle('blatFetch', async (_, url, body) => {
    // the BLAT partition's own fetch, not net.fetch: net.fetch is the default
    // session, whose cookies include the app's OAuth ones. credentials:'include'
    // here attaches only what this jar holds, i.e. a cf_clearance from a solve
    const response = await blatSession().fetch(parseBlatUrl(url).href, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      credentials: 'include',
      signal: AbortSignal.timeout(BLAT_TIMEOUT_MS),
    })
    return {
      ok: response.ok,
      status: response.status,
      text: await readCapped(response.body),
    }
  })
}
