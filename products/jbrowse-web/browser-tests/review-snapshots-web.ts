/* eslint-disable no-console */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  buildReviewPage,
  createVerdictRoutes,
  isVerdictStale,
  sendJson,
  serveReviewBundle,
} from '@jbrowse/browser-test-utils'

import {
  BACKENDS,
  collectSnapshots,
  compareBackends,
  diffImage,
  loadReport,
  referenceHash,
  referenceHashByName,
  referenceLocation,
  reportPath,
  snapshotPath,
  snapshotsDir,
} from './snapshot-review-lib.ts'

import type { SnapshotPayloadEntry } from './review-snapshot-payload.ts'
import type { Backend, BackendDiff } from './snapshot-review-lib.ts'

const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    port: { type: 'string' },
  },
})

if (values.help) {
  console.log(`Review browser-test snapshots in a web UI.

Usage: pnpm review-snapshots-web [--port=3336]

Two views:
  Basic pass  approve/deny each rendered snapshot (is it correct?)
  Backends    canvas2d vs webgl vs webgpu side-by-side, with drift % and diffs

Verdicts are written to ${path.relative(process.cwd(), reportPath)}.
`)
  process.exit(0)
}

const portVal = values.port ? Number(values.port) : Number.NaN
const port = Number.isFinite(portVal) ? portVal : 3336

function isBackend(s: string): s is Backend {
  return (BACKENDS as readonly string[]).includes(s)
}

function buildSnapshotPayload(): SnapshotPayloadEntry[] {
  const report = loadReport()
  return collectSnapshots().map(s => {
    const verdict = report[s.name]
    // the hash of the snapshot as the reviewer is about to see it — it
    // cache-busts the <img> and rides back as the precondition on the write, so
    // an approval means "I looked at these pixels" even if a test run replaces
    // them while the page is open
    const imageHash = referenceHash(s)
    // an approval/denial only resurfaces once the reviewed image changes
    const stale = isVerdictStale(verdict, imageHash)
    // which image the card shows — the same pick the hash above was taken from,
    // so the two cannot disagree about what a verdict is a verdict on
    const refLoc = referenceLocation(s)
    return {
      ...s,
      verdict,
      stale,
      imageHash: imageHash ?? null,
      refLoc: refLoc ?? null,
    }
  })
}

// Pairwise backend drift for every snapshot. Each comparison is a slow
// synchronous PNG decode (~170ms), and the full set takes ~25s — far too long
// to block startup or a request handler (that would starve image serving on the
// single-threaded event loop). So it's filled in the background after listen(),
// yielding between snapshots, and /api/compare returns the partial map plus a
// `done` flag the client polls on. Files don't change while we run.
const compareCache: Record<string, BackendDiff[]> = {}
let compareDone = false

async function buildCompareCacheInBackground() {
  for (const s of collectSnapshots()) {
    if (!s.isSvg && s.backends.length >= 2) {
      compareCache[s.name] = compareBackends(s.name)
      // let the event loop serve pending HTTP requests between each decode
      await new Promise(resolve => setImmediate(resolve))
    }
  }
  compareDone = true
  console.log(
    `Cross-backend drift computed for ${Object.keys(compareCache).length} snapshots`,
  )
}

const contentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

// A hand-typed or truncated URL can carry a malformed escape, which throws.
// That is a request for a path that does not exist, not a server error.
function decodePath(s: string): string | undefined {
  try {
    return decodeURIComponent(s)
  } catch {
    return undefined
  }
}

// Serve /img/<backend>/<name> (backend = canvas2d|webgl|webgpu|root). The lib's
// snapshotPath validates against traversal outside the snapshots tree.
function serveImage(res: http.ServerResponse, urlPath: string) {
  const rest = decodePath(urlPath.slice('/img/'.length))
  const slash = rest === undefined ? -1 : rest.indexOf('/')
  const loc = rest === undefined ? '' : rest.slice(0, slash)
  const full =
    rest === undefined
      ? undefined
      : snapshotPath(rest.slice(slash + 1), isBackend(loc) ? loc : undefined)
  if (!full || !fs.existsSync(full)) {
    res.writeHead(404)
    res.end('not found')
    return
  }
  res.writeHead(200, {
    'Content-Type':
      contentTypes[path.extname(full)] ?? 'application/octet-stream',
  })
  const stream = fs.createReadStream(full)
  // An unhandled stream 'error' is an uncaught exception — it fires after the
  // handler's try/catch has returned, so nothing here catches it and the whole
  // review server dies mid-session over one unreadable file. The 200 is already
  // out, so there is no status left to send: drop the connection and let the
  // <img> fail on its own.
  stream.on('error', () => {
    res.destroy()
  })
  stream.pipe(res)
}

// Serve /img-diff?name=&a=&b= — the visual diff between two backends.
function serveDiff(res: http.ServerResponse, query: URLSearchParams) {
  const name = query.get('name')
  const a = query.get('a')
  const b = query.get('b')
  const buf =
    name && a && b && isBackend(a) && isBackend(b)
      ? diffImage(name, a, b)
      : undefined
  if (buf) {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(buf)
  } else {
    res.writeHead(404)
    res.end('not found')
  }
}

// The write protocol — locked read-modify-write, the reviewedAt and image-hash
// preconditions, the 409 the page recovers from — is shared with the website's
// screenshot review; only the report and what a name hashes to differ.
const { handleVerdict, handleClearVerdict } = createVerdictRoutes({
  reportPath,
  hashOf: referenceHashByName,
  // 'answered' belongs to the website review's denial-reply flow; nothing here
  // produces it.
  statuses: ['good', 'bad'],
})

// The page is React, bundled once at startup — no watcher, no dev server, so
// "run one node script, open localhost" and offline operation both survive. Its
// write protocol and note-draft bookkeeping are shared with the website's
// screenshot review (@jbrowse/browser-test-utils/reviewApp); this entry supplies
// the two halves that differ, what a card looks like and what the header counts.
//
// Built before the server listens, so a syntax error in the page is a startup
// failure with esbuild's own message rather than a blank tab.
const bundle = await buildReviewPage({
  entry: path.resolve(import.meta.dirname, 'review-app', 'main.tsx'),
  title: 'Snapshot review',
  // tells this tab apart from the screenshot review UI, which the two tools are
  // expected to be open beside
  favicon: '📸',
})

const server = http.createServer((req, res) => {
  const raw = req.url ?? '/'
  const [urlPath, qs] = raw.split('?')
  const query = new URLSearchParams(qs ?? '')
  try {
    if (serveReviewBundle(res, urlPath ?? '/', bundle)) {
      // the page, its script and its stylesheet
    } else if (urlPath === '/api/snapshots') {
      sendJson(res, 200, buildSnapshotPayload())
    } else if (urlPath === '/api/compare') {
      sendJson(res, 200, { diffs: compareCache, done: compareDone })
    } else if (urlPath === '/api/verdict' && req.method === 'POST') {
      handleVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (urlPath === '/api/verdict/clear' && req.method === 'POST') {
      handleClearVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (urlPath === '/img-diff') {
      serveDiff(res, query)
    } else if (urlPath?.startsWith('/img/')) {
      serveImage(res, urlPath)
    } else {
      res.writeHead(404)
      res.end('not found')
    }
  } catch (err) {
    // an image route may already have committed its status line, and writing a
    // second one throws again — from a catch that has nowhere left to report
    if (res.headersSent) {
      res.destroy()
    } else {
      sendJson(res, 500, { error: `${err}` })
    }
  }
})

server.listen(port, () => {
  console.log(`Snapshot review UI: http://localhost:${port}`)
  console.log(
    `Snapshots: ${path.relative(process.cwd(), snapshotsDir)} (${BACKENDS.join(', ')})`,
  )
  console.log(
    `Writing verdicts to: ${path.relative(process.cwd(), reportPath)}`,
  )
  console.log('Computing cross-backend drift in the background…')
  buildCompareCacheInBackground().catch((err: unknown) => {
    console.error(`drift computation failed: ${err}`)
  })
})
