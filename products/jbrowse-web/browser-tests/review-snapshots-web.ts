/* eslint-disable no-console */
import fs from 'fs'
import http from 'http'
import path from 'path'
import { parseArgs } from 'util'

import {
  BACKENDS,
  collectSnapshots,
  compareBackends,
  diffImage,
  loadReport,
  referenceHash,
  referenceHashByName,
  reportPath,
  saveReport,
  snapshotPath,
  snapshotsDir,
} from './snapshot-review-lib.ts'

import type { Backend, BackendDiff, Verdict } from './snapshot-review-lib.ts'

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

function buildSnapshotPayload() {
  const report = loadReport()
  return collectSnapshots().map(s => {
    const verdict = report[s.name]
    // An approval/denial only resurfaces when the reviewed image has actually
    // changed since: current reference hash no longer matches the stored one.
    // A verdict from before hashing (no stored hash) is taken at face value.
    const stale =
      verdict?.hash !== undefined && verdict.hash !== referenceHash(s)
    return { ...s, verdict, stale }
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

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let data = ''
    req.on('data', chunk => {
      data += chunk
    })
    req.on('end', () => {
      resolve(data)
    })
  })
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const contentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

// Serve /img/<backend>/<name> (backend = canvas2d|webgl|webgpu|root). The lib's
// snapshotPath validates against traversal outside the snapshots tree.
function serveImage(res: http.ServerResponse, urlPath: string) {
  const rest = decodeURIComponent(urlPath.slice('/img/'.length))
  const slash = rest.indexOf('/')
  const loc = rest.slice(0, slash)
  const name = rest.slice(slash + 1)
  const full = snapshotPath(name, isBackend(loc) ? loc : undefined)
  if (!full || !fs.existsSync(full)) {
    res.writeHead(404)
    res.end('not found')
  } else {
    res.writeHead(200, {
      'Content-Type':
        contentTypes[path.extname(full)] ?? 'application/octet-stream',
    })
    fs.createReadStream(full).pipe(res)
  }
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

// Validate untrusted bodies rather than blindly casting; a malformed POST would
// otherwise write a garbage verdict into the report.
function parseVerdictBody(
  raw: string,
): { name: string; status: 'good' | 'bad'; note: string } | undefined {
  const body: unknown = JSON.parse(raw)
  if (
    typeof body === 'object' &&
    body !== null &&
    'name' in body &&
    typeof body.name === 'string' &&
    body.name !== '' &&
    'status' in body &&
    (body.status === 'good' || body.status === 'bad')
  ) {
    const note =
      'note' in body && typeof body.note === 'string' ? body.note : ''
    return { name: body.name, status: body.status, note }
  }
  return undefined
}

function parseNameBody(raw: string): string | undefined {
  const body: unknown = JSON.parse(raw)
  return typeof body === 'object' &&
    body !== null &&
    'name' in body &&
    typeof body.name === 'string' &&
    body.name !== ''
    ? body.name
    : undefined
}

async function handleVerdict(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const parsed = parseVerdictBody(await readBody(req))
  if (parsed) {
    const report = loadReport()
    const verdict: Verdict = {
      ...parsed,
      reviewedAt: new Date().toISOString(),
      hash: referenceHashByName(parsed.name),
    }
    report[parsed.name] = verdict
    saveReport(report)
    sendJson(res, 200, verdict)
  } else {
    sendJson(res, 400, { error: 'invalid verdict body' })
  }
}

async function handleClearVerdict(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const name = parseNameBody(await readBody(req))
  if (name) {
    const report = loadReport()
    if (report[name]) {
      delete report[name]
      saveReport(report)
    }
    sendJson(res, 200, { name, cleared: true })
  } else {
    sendJson(res, 400, { error: 'invalid body' })
  }
}

const server = http.createServer((req, res) => {
  const raw = req.url ?? '/'
  const [urlPath, qs] = raw.split('?')
  const query = new URLSearchParams(qs ?? '')
  try {
    if (urlPath === '/' || urlPath === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(PAGE)
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
    sendJson(res, 500, { error: `${err}` })
  }
})

server.listen(port, () => {
  console.log(`Snapshot review UI: http://localhost:${port}`)
  console.log(
    `Snapshots: ${path.relative(process.cwd(), snapshotsDir)} (${BACKENDS.join(', ')})`,
  )
  console.log(`Writing verdicts to: ${path.relative(process.cwd(), reportPath)}`)
  console.log('Computing cross-backend drift in the background…')
  buildCompareCacheInBackground().catch((err: unknown) => {
    console.error(`drift computation failed: ${err}`)
  })
})

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Snapshot review</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0; background: #f4f5f7; color: #1a1a1a;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    background: #fff; border-bottom: 1px solid #ddd;
    padding: 12px 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
  }
  header h1 { font-size: 16px; margin: 0; }
  header input[type=search] { padding: 6px 10px; width: 220px; border: 1px solid #ccc; border-radius: 6px; }
  .tabs { display: flex; gap: 6px; }
  .tab {
    padding: 7px 14px; border: 1px solid #ccc; border-radius: 6px; background: #fff;
    cursor: pointer; font-size: 14px; font-weight: 500; color: #555;
  }
  .tab.active { background: #2563eb; border-color: #2563eb; color: #fff; }
  .tab .tabcount { opacity: 0.7; margin-left: 5px; font-size: 12px; }
  .counts { font-size: 13px; color: #555; margin-left: auto; display: flex; gap: 14px; flex-wrap: wrap; }
  .pill { padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
  .pill.good { background: #d6f5dd; color: #14532d; }
  .pill.bad { background: #fbd9d9; color: #7f1d1d; }
  .pill.none { background: #eee; color: #666; }
  .pill.targeted { background: #dbeafe; color: #1e40af; }
  .pill.fullpage { background: #fef3c7; color: #92400e; }
  .pill.svg { background: #f3e8ff; color: #6b21a8; }
  .pill.other { background: #eee; color: #555; }
  .pill.ident { background: #d6f5dd; color: #14532d; }
  .pill.drift { background: #fde68a; color: #854d0e; }
  .pill.bigdrift { background: #fbd9d9; color: #7f1d1d; }
  .pill.absent { background: #eee; color: #999; }
  .pill.stale { background: #fde68a; color: #854d0e; }
  main { padding: 20px; display: flex; flex-direction: column; gap: 18px; max-width: 1500px; margin: 0 auto; }
  .card { background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden; }
  .card.good { border-left: 5px solid #22c55e; }
  .card.bad { border-left: 5px solid #ef4444; }
  .card.stale { border-left: 5px solid #f59e0b; }
  .card-images { display: flex; gap: 0; }
  .imgcol { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .imglabel {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 4px 10px; background: #f8f8f8; border-bottom: 1px solid #eee; color: #666;
    display: flex; justify-content: space-between; align-items: center; gap: 6px;
  }
  .imgwrap { background: #222; display: flex; align-items: center; justify-content: center; min-height: 160px; flex: 1; }
  .imgwrap img { max-width: 100%; max-height: 380px; display: block; cursor: zoom-in; }
  .imgcol + .imgcol { border-left: 2px solid #ddd; }
  .missing { color: #888; padding: 30px; font-size: 13px; }
  .meta { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #eee; }
  .meta h2 { font-size: 14px; margin: 0; font-family: ui-monospace, monospace; word-break: break-all; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  button { padding: 7px 14px; border-radius: 6px; border: 1px solid #ccc; background: #fff; cursor: pointer; font-size: 14px; }
  button.approve { border-color: #22c55e; color: #14532d; }
  button.approve.active { background: #22c55e; color: #fff; }
  button.deny { border-color: #ef4444; color: #7f1d1d; }
  button.deny.active { background: #ef4444; color: #fff; }
  button.clear { border-color: #ccc; color: #666; }
  .note { width: 100%; padding: 6px 9px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; }
  .reviewedAt { font-size: 11px; color: #999; }
</style>
</head>
<body>
<header>
  <h1>Snapshot review</h1>
  <div class="tabs">
    <button class="tab" data-page="basic">Basic pass<span class="tabcount" data-count="page-basic"></span></button>
    <button class="tab" data-page="backends">Backends<span class="tabcount" data-count="page-backends"></span></button>
  </div>
  <input id="search" type="search" placeholder="filter by name…" />
  <div class="tabs" data-group="status">
    <button class="tab" data-status="needs">Needs review<span class="tabcount" data-count="needs"></span></button>
    <button class="tab" data-status="all">All</button>
    <button class="tab" data-status="good">Approved</button>
    <button class="tab" data-status="bad">Denied</button>
  </div>
  <div class="tabs" data-group="kind">
    <button class="tab" data-kind="all">All</button>
    <button class="tab" data-kind="targeted">Targeted</button>
    <button class="tab" data-kind="fullpage">Full-page</button>
    <button class="tab" data-kind="svg">SVG</button>
  </div>
  <div class="tabs" data-group="drift">
    <button class="tab" data-drift="all">All</button>
    <button class="tab" data-drift="drift">Drifting<span class="tabcount" data-count="drift-any"></span></button>
  </div>
  <div class="counts" id="counts"></div>
</header>
<main id="main"></main>
<script>
let data = []
let compare = {}
const filters = { page: 'basic', status: 'needs', kind: 'all', drift: 'all' }
let justActed = new Set()
const DRIFT_THRESHOLD = 5 // percent; mirrors compare-backends.ts similar/different split

const $ = sel => document.querySelector(sel)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const pill = (cls, text) => '<span class="pill ' + cls + '">' + text + '</span>'

function changeFilter(key, value) {
  filters[key] = value
  justActed = new Set()
  render()
}

async function load() {
  data = await (await fetch('/api/snapshots')).json()
  render()
  // backend drift is computed in the background server-side; poll until done,
  // re-rendering as the map fills in so drift pills/filters progressively appear
  while (true) {
    const r = await (await fetch('/api/compare')).json()
    compare = r.diffs
    // a full re-render rebuilds #main and would drop focus / unsaved note text,
    // so hold off while a field is being edited — the next poll catches up
    if (document.activeElement?.tagName !== 'INPUT') { render() }
    if (r.done) { break }
    await new Promise(res => setTimeout(res, 2000))
  }
}

// Worst pairwise drift % across backends for a snapshot, or -1 if not comparable
function maxDrift(name) {
  const pairs = compare[name]
  if (!pairs) { return -1 }
  let worst = -1
  for (const p of pairs) {
    if (typeof p.diffFraction === 'number') {
      worst = Math.max(worst, p.diffFraction * 100)
    }
  }
  return worst
}
const isDrifting = name => maxDrift(name) >= DRIFT_THRESHOLD

function driftPill(pct) {
  if (pct < 0) { return pill('absent', 'n/a') }
  if (pct === 0) { return pill('ident', 'identical') }
  if (pct < DRIFT_THRESHOLD) { return pill('drift', pct.toFixed(2) + '%') }
  return pill('bigdrift', pct.toFixed(2) + '%')
}

function imgTag(loc, name) {
  return '<img src="/img/' + loc + '/' + encodeURIComponent(name) + '" onclick="window.open(this.src)" />'
}

function imgCol(label, right, inner) {
  return '<div class="imgcol">' +
    '<div class="imglabel"><span>' + label + '</span><span>' + (right || '') + '</span></div>' +
    '<div class="imgwrap">' + inner + '</div>' +
  '</div>'
}

function kindPill(s) { return pill(s.kind, s.kind) }

// pick the reference image: canvas2d first, then webgl/webgpu, then root
function refLoc(s) {
  return s.backends.includes('canvas2d') ? 'canvas2d'
    : s.backends[0] || (s.inRoot ? 'root' : null)
}

// a snapshot needs review when it has no verdict, or its verdict went stale
// because the reviewed image changed since (server-computed stale flag)
const needsReview = s => !s.verdict || s.stale

function basicCard(s) {
  const v = s.verdict
  const status = v ? v.status : 'none'
  const cls = s.stale ? 'stale' : status
  const loc = refLoc(s)
  const img = loc ? imgTag(loc, s.name) : '<div class="missing">⚠ no image on disk</div>'
  const where = [s.inRoot ? 'root' : null, ...s.backends].filter(Boolean).join(', ')
  return '<div class="card ' + cls + '" data-name="' + esc(s.name) + '">' +
    '<div class="card-images">' + imgCol(loc ? 'rendered (' + loc + ')' : 'rendered', '', img) + '</div>' +
    '<div class="meta">' +
      '<h2>' + esc(s.name) + ' ' + kindPill(s) +
        (s.stale ? ' ' + pill('stale', 'image changed since ' + status) : '') +
        (compare[s.name] ? ' ' + driftPill(maxDrift(s.name)) : '') + '</h2>' +
      '<div class="reviewedAt">present in: ' + esc(where) + '</div>' +
      '<input class="note" placeholder="note (optional)" value="' + esc(v ? v.note : '') + '" onchange="saveNote(this)" />' +
      '<div class="actions">' +
        '<button class="approve ' + (status === 'good' ? 'active' : '') + '" onclick="setVerdict(this,\\'good\\')">✓ Approve</button>' +
        '<button class="deny ' + (status === 'bad' ? 'active' : '') + '" onclick="setVerdict(this,\\'bad\\')">✗ Deny</button>' +
        (v ? '<button class="clear" onclick="clearVerdict(this)">clear</button>' : '') +
        (v ? '<span class="reviewedAt">' + new Date(v.reviewedAt).toLocaleString() + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>'
}

// drift % for a specific backend pair from the compare payload
function pairPct(name, a, b) {
  const pairs = compare[name] || []
  const p = pairs.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a))
  return p && typeof p.diffFraction === 'number' ? p.diffFraction * 100 : -1
}

function backendCard(s) {
  const cols = ['canvas2d', 'webgl', 'webgpu'].map(b =>
    s.backends.includes(b)
      ? imgCol(b, '', imgTag(b, s.name))
      : imgCol(b, '', '<div class="missing">not captured</div>')
  ).join('')
  // diff thumbnails for each comparable pair
  const diffs = (compare[s.name] || []).filter(p => typeof p.diffFraction === 'number').map(p =>
    imgCol(p.a + ' vs ' + p.b, driftPill(p.diffFraction * 100),
      '<img src="/img-diff?name=' + encodeURIComponent(s.name) + '&a=' + p.a + '&b=' + p.b + '" onclick="window.open(this.src)" />')
  ).join('')
  return '<div class="card" data-name="' + esc(s.name) + '">' +
    '<div class="card-images">' + cols + '</div>' +
    (diffs ? '<div class="card-images">' + diffs + '</div>' : '') +
    '<div class="meta"><h2>' + esc(s.name) + ' ' + kindPill(s) +
      ' ' + driftPill(maxDrift(s.name)) + '</h2></div>' +
  '</div>'
}

function specsInPage() {
  return filters.page === 'backends'
    ? data.filter(s => !s.isSvg && s.backends.length >= 2)
    : data
}

function syncControls() {
  for (const key of ['page', 'status', 'kind', 'drift']) {
    for (const b of document.querySelectorAll('header [data-' + key + ']')) {
      b.classList.toggle('active', b.dataset[key] === filters[key])
    }
  }
  // status filter only meaningful on the basic-pass page
  $('[data-group="status"]').style.display = filters.page === 'basic' ? '' : 'none'
}

function renderCounts() {
  $('[data-count="page-basic"]').textContent = data.length
  $('[data-count="page-backends"]').textContent = data.filter(s => !s.isSvg && s.backends.length >= 2).length
  $('[data-count="drift-any"]').textContent = data.filter(s => isDrifting(s.name)).length
  $('[data-count="needs"]').textContent = data.filter(needsReview).length
  const inPage = specsInPage()
  if (filters.page === 'basic') {
    const good = inPage.filter(s => s.verdict?.status === 'good' && !s.stale).length
    const bad = inPage.filter(s => s.verdict?.status === 'bad' && !s.stale).length
    const stale = inPage.filter(s => s.stale).length
    $('#counts').innerHTML =
      pill('good', good + ' approved') +
      pill('bad', bad + ' denied') +
      (stale ? pill('stale', stale + ' changed since review') : '') +
      pill('none', inPage.filter(s => !s.verdict).length + ' unreviewed')
  } else {
    const drifting = inPage.filter(s => isDrifting(s.name)).length
    $('#counts').innerHTML =
      pill('bigdrift', drifting + ' drifting ≥' + DRIFT_THRESHOLD + '%') +
      pill('none', inPage.length + ' comparable')
  }
}

function matchesFilters(s, q) {
  const matchesQuery = !q || s.name.toLowerCase().includes(q)
  const matchesStatus =
    filters.page !== 'basic' ||
    filters.status === 'all' ||
    (filters.status === 'needs' && needsReview(s)) ||
    (filters.status === 'good' && s.verdict?.status === 'good' && !s.stale) ||
    (filters.status === 'bad' && s.verdict?.status === 'bad' && !s.stale)
  const matchesKind = filters.kind === 'all' || s.kind === filters.kind
  const matchesDrift = filters.drift === 'all' || isDrifting(s.name)
  return matchesQuery &&
    (justActed.has(s.name) || (matchesStatus && matchesKind && matchesDrift))
}

function render() {
  syncControls()
  renderCounts()
  const q = $('#search').value.toLowerCase()
  const visible = specsInPage().filter(s => matchesFilters(s, q))
  const card = filters.page === 'basic' ? basicCard : backendCard
  $('#main').innerHTML = visible.map(card).join('')
}

const cardEl = btn => btn.closest('.card')

async function postVerdict(name, status, note) {
  await fetch('/api/verdict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, status, note }),
  })
}

async function setVerdict(btn, status) {
  const el = cardEl(btn)
  const name = el.dataset.name
  const note = el.querySelector('.note').value
  await postVerdict(name, status, note)
  const s = data.find(x => x.name === name)
  if (s) {
    // verdict was just recorded against the current image, so it's no longer stale
    s.verdict = { name, status, note, reviewedAt: new Date().toISOString() }
    s.stale = false
  }
  justActed.add(name)
  updateCard(name)
}

async function saveNote(input) {
  const name = cardEl(input).dataset.name
  const s = data.find(x => x.name === name)
  if (s && s.verdict) {
    s.verdict = { ...s.verdict, note: input.value }
    await postVerdict(name, s.verdict.status, input.value)
  }
}

async function clearVerdict(btn) {
  const name = cardEl(btn).dataset.name
  await fetch('/api/verdict/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const s = data.find(x => x.name === name)
  if (s) {
    s.verdict = undefined
    s.stale = false
  }
  updateCard(name)
}

// Re-render a single card in place so acting on one never wipes unsaved note
// text typed into other cards.
function updateCard(name) {
  const s = data.find(x => x.name === name)
  const el = [...document.querySelectorAll('.card')].find(c => c.dataset.name === name)
  if (s && el) {
    el.outerHTML = basicCard(s)
  }
  renderCounts()
}

$('header').addEventListener('click', e => {
  const btn = e.target.closest('[data-page],[data-status],[data-kind],[data-drift]')
  if (btn) {
    const key = btn.dataset.page ? 'page'
      : btn.dataset.status ? 'status'
      : btn.dataset.kind ? 'kind' : 'drift'
    changeFilter(key, btn.dataset[key])
  }
})
$('#search').addEventListener('input', render)
load()
</script>
</body>
</html>`
