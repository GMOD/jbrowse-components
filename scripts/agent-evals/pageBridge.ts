// Serves a jbrowse-web build with one script injected into its page: a poll
// loop that fetches code from this server, evaluates it in the page with `jb`
// and `session` in scope, and posts the value back. It is how a harness grades
// the page an agent drove and resets it between tasks, without a CDP
// connection: the Claude in Chrome extension owns the browser, and a second
// debugger on the same Chrome is the documented way to wedge both.
//
// Every page load mints its own token and polls with it, so a job is handed
// to one page and the harness can tell the tab it reset from a tab the agent
// left on a docs site or opened beside it. A hidden tab does not poll, so a
// backgrounded duplicate cannot take a job meant for the one on screen.
//
// The bridge is the harness's, not the app's: it lives in the copy served
// here, on the same origin as the page, and nothing in build/ is touched.
// Range requests are honoured because the bigWig and tabix readers issue
// them; a 200 with the whole file answers those with the wrong bytes.
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.gz': 'application/gzip',
}

const BRIDGE_PATH = '/__eval/bridge.js'
const POLL_MS = 250
const ALIVE_MS = 2000

// runs in the page
const BRIDGE_JS = `
(() => {
  const token = crypto.randomUUID()
  const AsyncFunction = (async () => {}).constructor
  async function poll() {
    let job
    if (document.visibilityState === 'visible') {
      try {
        const q = new URLSearchParams({ token, href: location.href })
        const r = await fetch('/__eval/next?' + q, { cache: 'no-store' })
        job = r.status === 200 ? await r.json() : undefined
      } catch {}
    }
    if (job) {
      let body
      try {
        const fn = new AsyncFunction('jb', 'session', 'answer', job.code)
        const value = await fn(window.jb, window.JBrowseSession, job.answer ?? '')
        body = { id: job.id, value: value === undefined ? null : value }
      } catch (e) {
        body = { id: job.id, error: String(e && e.stack || e) }
      }
      try {
        await fetch('/__eval/result', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch {}
    }
    setTimeout(poll, ${POLL_MS})
  }
  poll()
})()
`

interface Job {
  id: number
  token: string
  code: string
  answer?: string
  resolve: (value: unknown) => void
  reject: (e: Error) => void
}

export interface BridgePage {
  token: string
  href: string
  loadedAt: number
  lastPoll: number
}

export interface PageBridge {
  url: string
  /** the pages that polled within the last two seconds, newest load first */
  pages: () => BridgePage[]
  /** the newest live page on the served origin, or undefined */
  current: () => BridgePage | undefined
  /** resolves with the first live page on the served origin loaded after `after` */
  waitForPage: (timeoutMs: number, after?: number) => Promise<BridgePage>
  /** evaluate an async function body in one page, with jb, session and answer in scope */
  evaluate: (
    code: string,
    opts?: { page?: BridgePage; answer?: string; timeoutMs?: number },
  ) => Promise<unknown>
  close: () => void
}

function serveFile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  file: string,
) {
  const { size } = fs.statSync(file)
  res.setHeader(
    'content-type',
    MIME[path.extname(file)] ?? 'application/octet-stream',
  )
  res.setHeader('accept-ranges', 'bytes')
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '')
  if (range) {
    const start = range[1]
      ? Number(range[1])
      : Math.max(0, size - Number(range[2]))
    const end =
      range[2] && range[1] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) {
      res.statusCode = 416
      res.setHeader('content-range', `bytes */${size}`)
      res.end()
      return
    }
    res.statusCode = 206
    res.setHeader('content-range', `bytes ${start}-${end}/${size}`)
    res.setHeader('content-length', end - start + 1)
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    fs.createReadStream(file, { start, end }).pipe(res)
    return
  }
  res.setHeader('content-length', size)
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  fs.createReadStream(file).pipe(res)
}

export function servePageBridge(buildDir: string): Promise<PageBridge> {
  const queue: Job[] = []
  const inFlight = new Map<number, Job>()
  const known = new Map<string, BridgePage>()
  let nextId = 0

  function readBody(req: http.IncomingMessage) {
    return new Promise<string>(resolve => {
      let data = ''
      req.on('data', chunk => {
        data += chunk
      })
      req.on('end', () => {
        resolve(data)
      })
    })
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === BRIDGE_PATH) {
      res.setHeader('content-type', 'text/javascript')
      res.end(BRIDGE_JS)
      return
    }
    if (url.pathname === '/__eval/next') {
      const token = url.searchParams.get('token') ?? ''
      const now = Date.now()
      const page = known.get(token) ?? {
        token,
        href: '',
        loadedAt: now,
        lastPoll: now,
      }
      page.href = url.searchParams.get('href') ?? page.href
      page.lastPoll = now
      known.set(token, page)
      const at = queue.findIndex(j => j.token === token)
      if (at !== -1) {
        const [job] = queue.splice(at, 1)
        inFlight.set(job!.id, job!)
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({ id: job!.id, code: job!.code, answer: job!.answer }),
        )
      } else {
        res.statusCode = 204
        res.end()
      }
      return
    }
    if (url.pathname === '/__eval/result') {
      const body = JSON.parse(await readBody(req)) as {
        id: number
        value?: unknown
        error?: string
      }
      const job = inFlight.get(body.id)
      inFlight.delete(body.id)
      if (job) {
        if (body.error !== undefined) {
          job.reject(new Error(body.error))
        } else {
          job.resolve(body.value)
        }
      }
      res.statusCode = 204
      res.end()
      return
    }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const file = path.join(buildDir, rel)
    if (!file.startsWith(buildDir) || !fs.existsSync(file)) {
      res.statusCode = 404
      res.end()
      return
    }
    if (rel === 'index.html') {
      const html = fs.readFileSync(file, 'utf8')
      res.setHeader('content-type', 'text/html')
      res.end(
        html.replace(
          '</head>',
          `<script src="${BRIDGE_PATH}"></script></head>`,
        ),
      )
      return
    }
    serveFile(req, res, file)
  })

  return new Promise(resolve => {
    server.listen(0, () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const origin = `http://localhost:${port}/`
      const pages = () =>
        [...known.values()]
          .filter(p => Date.now() - p.lastPoll < ALIVE_MS)
          .sort((a, b) => b.loadedAt - a.loadedAt)
      const current = () => pages().find(p => p.href.startsWith(origin))
      resolve({
        url: origin,
        pages,
        current,
        waitForPage: async (timeoutMs, after = 0) => {
          const deadline = Date.now() + timeoutMs
          for (;;) {
            const page = pages().find(
              p => p.href.startsWith(origin) && p.loadedAt > after,
            )
            if (page) {
              return page
            }
            if (Date.now() > deadline) {
              throw new Error('no page carrying the eval bridge polled in time')
            }
            await new Promise(r => setTimeout(r, 200))
          }
        },
        evaluate: (code, opts = {}) =>
          new Promise((resolveValue, reject) => {
            const page = opts.page ?? current()
            if (!page) {
              reject(
                new Error('no live page on the served origin to evaluate in'),
              )
              return
            }
            const id = ++nextId
            const timer = setTimeout(() => {
              inFlight.delete(id)
              const at = queue.findIndex(j => j.id === id)
              if (at !== -1) {
                queue.splice(at, 1)
              }
              reject(new Error(`page evaluation ${id} timed out`))
            }, opts.timeoutMs ?? 60_000)
            queue.push({
              id,
              token: page.token,
              code,
              answer: opts.answer,
              resolve: value => {
                clearTimeout(timer)
                resolveValue(value)
              },
              reject: e => {
                clearTimeout(timer)
                reject(e)
              },
            })
          }),
        close: () => {
          server.close()
        },
      })
    })
  })
}
