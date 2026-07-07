import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

import { isVerdictStale } from '@jbrowse/browser-test-utils'

import {
  collectScreenshots,
  imageHash,
  imgDir,
  loadReport,
  readMainPng,
  reportPath,
  saveReport,
  websiteRoot,
} from './screenshot-review-lib.ts'
import { specs } from './screenshot-specs.ts'

import type { Verdict } from './screenshot-review-lib.ts'

const cliArgs = process.argv.slice(2)
const portArg = cliArgs.find(a => a.startsWith('--port='))
const portVal = portArg ? Number(portArg.split('=')[1]) : Number.NaN
const port = Number.isFinite(portVal) ? portVal : 3335

function buildSpecPayload() {
  const report = loadReport()
  return collectScreenshots(specs).map(shot => {
    const verdict = report[shot.name]
    // an approval/denial only resurfaces once the reviewed image changes
    const stale = isVerdictStale(verdict, imageHash(shot.name))
    return { ...shot, verdict, stale }
  })
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
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

// Serve /img/<name>.png, guarding against path traversal outside imgDir
function serveImage(res: http.ServerResponse, urlPath: string) {
  const rel = decodeURIComponent(urlPath.slice('/img/'.length))
  const full = path.resolve(imgDir, rel)
  if (!full.startsWith(imgDir + path.sep) || !fs.existsSync(full)) {
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

// Serve /img-main/<name>.png from origin/main via git show
function serveMainImage(res: http.ServerResponse, urlPath: string) {
  const name = decodeURIComponent(urlPath.slice('/img-main/'.length)).replace(
    /\.png$/,
    '',
  )
  const buf = readMainPng(name)
  if (!buf) {
    res.writeHead(404)
    res.end('not found')
  } else {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(buf)
  }
}

// Validate untrusted request bodies rather than blindly casting; a malformed
// POST otherwise writes a garbage verdict into the report.
function parseName(body: unknown): string | undefined {
  return typeof body === 'object' &&
    body !== null &&
    'name' in body &&
    typeof body.name === 'string' &&
    body.name !== ''
    ? body.name
    : undefined
}

function parseVerdictBody(
  raw: string,
): { name: string; status: 'good' | 'bad'; note: string } | undefined {
  const body: unknown = JSON.parse(raw)
  const name = parseName(body)
  if (
    name === undefined ||
    typeof body !== 'object' ||
    body === null ||
    !('status' in body) ||
    (body.status !== 'good' && body.status !== 'bad')
  ) {
    return undefined
  }
  const note = 'note' in body && typeof body.note === 'string' ? body.note : ''
  return { name, status: body.status, note }
}

function parseNameBody(raw: string): string | undefined {
  return parseName(JSON.parse(raw))
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
      hash: imageHash(parsed.name),
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
  const url = req.url ?? '/'
  const pathname = url.split('?')[0]!
  try {
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(PAGE)
    } else if (pathname === '/api/specs') {
      sendJson(res, 200, buildSpecPayload())
    } else if (pathname === '/api/verdict' && req.method === 'POST') {
      handleVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (pathname === '/api/verdict/clear' && req.method === 'POST') {
      handleClearVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (pathname.startsWith('/img-main/')) {
      serveMainImage(res, pathname)
    } else if (pathname.startsWith('/img/')) {
      serveImage(res, pathname)
    } else {
      res.writeHead(404)
      res.end('not found')
    }
  } catch (err) {
    sendJson(res, 500, { error: `${err}` })
  }
})

server.listen(port, () => {
  console.log(`Screenshot review UI: http://localhost:${port}`)
  console.log(`Writing verdicts to: ${path.relative(websiteRoot, reportPath)}`)
})

const PAGE = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Screenshot review</title>
<style>
  /* Surfaces/text/borders use CSS system colors so light and dark themes both
     work with no media query — the browser maps Canvas/Field/etc per scheme.
     Vivid accents (tab blue, pill pastels, card edges) stay fixed. */
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    background: Canvas;
    color: CanvasText;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    background: Canvas; border-bottom: 1px solid ButtonBorder;
    padding: 12px 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
  }
  header h1 { font-size: 16px; margin: 0; }
  header input[type=search] { padding: 6px 10px; width: 220px; border: 1px solid ButtonBorder; border-radius: 6px; background: Field; color: FieldText; }
  header select { padding: 6px 8px; border: 1px solid ButtonBorder; border-radius: 6px; font-size: 13px; background: Field; color: FieldText; cursor: pointer; }
  header select option { background: Field; color: FieldText; }
  header label { font-size: 13px; display: flex; gap: 5px; align-items: center; cursor: pointer; }
  .ctrl { flex-direction: column; align-items: flex-start; gap: 2px; }
  .ctrl > span { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: GrayText; }
  .tabs { display: flex; gap: 6px; }
  .tab {
    padding: 7px 14px; border: 1px solid ButtonBorder; border-radius: 6px; background: Canvas;
    cursor: pointer; font-size: 14px; font-weight: 500; color: CanvasText;
  }
  .tab.active { background: #2563eb; border-color: #2563eb; color: #fff; }
  .tab .tabcount { opacity: 0.7; margin-left: 5px; font-size: 12px; }
  .counts { font-size: 13px; color: GrayText; margin-left: auto; display: flex; gap: 14px; flex-wrap: wrap; }
  .pill { padding: 1px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; }
  .pill.good { background: #d6f5dd; color: #14532d; }
  .pill.bad { background: #fbd9d9; color: #7f1d1d; }
  .pill.none { background: #eee; color: #666; }
  .pill.auto { background: #dbeafe; color: #1e40af; }
  .pill.manual { background: #f3e8ff; color: #6b21a8; }
  .pill.new { background: #cffafe; color: #155e63; }
  .pill.changed, .pill.stale { background: #fde68a; color: #854d0e; }
  main { padding: 20px; display: flex; flex-direction: column; gap: 18px; max-width: 1400px; margin: 0 auto; }
  .card {
    background: Canvas; border: 1px solid ButtonBorder; border-radius: 10px; overflow: hidden;
  }
  .card.good { border-left: 5px solid #22c55e; }
  .card.bad { border-left: 5px solid #ef4444; }
  .card.stale { border-left: 5px solid #f59e0b; }
  .card-images {
    display: flex; gap: 0;
  }
  .imgcol { flex: 1; display: flex; flex-direction: column; }
  .imglabel {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 4px 10px; background: Canvas; border-bottom: 1px solid ButtonBorder; color: GrayText;
  }
  .imgwrap { background: #222; display: flex; align-items: center; justify-content: center; min-height: 180px; flex: 1; }
  .imgwrap img { max-width: 100%; max-height: 400px; display: block; cursor: zoom-in; }
  .imgcol + .imgcol { border-left: 2px solid ButtonBorder; }
  .missing { color: #f88; padding: 30px; font-size: 14px; }
  .meta { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid ButtonBorder; }
  .meta h2 { font-size: 14px; margin: 0; font-family: ui-monospace, monospace; word-break: break-all; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .usages { font-size: 13px; display: flex; flex-direction: column; gap: 8px; }
  .usage { border-left: 3px solid ButtonBorder; padding-left: 10px; }
  .usage .loc { font-family: ui-monospace, monospace; font-size: 12px; color: LinkText; }
  .usage .caption { font-style: italic; margin-top: 2px; }
  .noref { font-size: 13px; color: #b45309; }
  .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  button { padding: 7px 14px; border-radius: 6px; border: 1px solid ButtonBorder; background: ButtonFace; color: ButtonText; cursor: pointer; font-size: 14px; }
  button.approve { border-color: #22c55e; color: #16a34a; }
  button.approve.active { background: #22c55e; color: #fff; }
  button.deny { border-color: #ef4444; color: #dc2626; }
  button.deny.active { background: #ef4444; color: #fff; }
  button.clear { border-color: ButtonBorder; color: GrayText; }
  .note { width: 100%; padding: 6px 9px; border: 1px solid ButtonBorder; border-radius: 6px; font-size: 13px; background: Field; color: FieldText; }
  .reviewedAt { font-size: 11px; color: GrayText; }
</style>
</head>
<body>
<header>
  <h1>Screenshot review</h1>
  <input id="search" type="search" placeholder="filter by name…" />
  <label class="ctrl"><span>Group</span>
    <select id="group" title="Filter by name group"><option value="">All groups</option></select>
  </label>
  <label class="ctrl"><span>Kind</span>
    <select id="kind" title="Filter by how the image is produced">
      <option value="all">All kinds</option>
      <option value="manual">Manual only</option>
      <option value="auto">Autogenerated only</option>
    </select>
  </label>
  <label class="ctrl"><span>Sort</span>
    <select id="sortby" title="Sort order">
      <option value="default">A–Z</option>
      <option value="recent">Recently reviewed</option>
    </select>
  </label>
  <div class="tabs">
    <button class="tab" data-status="needs">Needs review<span class="tabcount" data-count="needs"></span></button>
    <button class="tab" data-status="good">Approved</button>
    <button class="tab" data-status="bad">Denied</button>
    <button class="tab" data-status="all">All</button>
  </div>
  <button class="tab" data-toggle="changed" title="only screenshots new or changed vs origin/main">Changed vs main<span class="tabcount" data-count="changed"></span></button>
  <div class="counts" id="counts"></div>
</header>
<main id="main"></main>
<script>
let data = []
const filters = { status: 'needs', changedOnly: false, sortBy: 'default', group: '', kind: 'all' }
// Names acted on since the current filter view was entered. They stay visible
// even once their new verdict no longer matches the filter, so you can still
// type a reason after clicking Deny in the unreviewed/denied queue.
let justActed = new Set()

const $ = sel => document.querySelector(sel)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const pill = (cls, text) => '<span class="pill ' + cls + '">' + text + '</span>'

// Most spec names are namespaced with '/' (gallery/x, multiway_synteny/x);
// only the hand-listed desktop-* names use a hyphen instead. Grouping only on
// '-' left ~85% of names in a singleton group of their own.
const nameGroup = name => name.includes('/') ? name.split('/')[0] : (name.includes('-') ? name.split('-')[0] : name)

// Persist the current filter state in the URL query string so a review view can
// be reloaded, bookmarked, or shared. Only non-default values are written to
// keep the URL clean.
function writeUrl() {
  const params = new URLSearchParams()
  const q = $('#search').value
  if (q) params.set('q', q)
  if (filters.status !== 'needs') params.set('status', filters.status)
  if (filters.changedOnly) params.set('changed', '1')
  if (filters.sortBy !== 'default') params.set('sort', filters.sortBy)
  if (filters.group) params.set('group', filters.group)
  if (filters.kind !== 'all') params.set('kind', filters.kind)
  const qs = params.toString()
  history.replaceState(null, '', qs ? '?' + qs : location.pathname)
}

function readUrl() {
  const params = new URLSearchParams(location.search)
  const status = params.get('status')
  if (status) filters.status = status
  filters.changedOnly = params.get('changed') === '1'
  const sort = params.get('sort')
  if (sort) filters.sortBy = sort
  const group = params.get('group')
  if (group) filters.group = group
  const kind = params.get('kind')
  if (kind) filters.kind = kind
  const q = params.get('q')
  if (q) $('#search').value = q
}

// Diff vs origin/main, the screenshots a branch review cares about:
// "new" = added on this branch (not on main); "changed" = on main but the
// working-tree pixels differ (an update). \`s.changed\` is computed server-side.
const isNew = s => s.exists && !s.existsOnMain
const isChanged = s => s.changed
// needs review when unreviewed, or its verdict went stale because the reviewed
// image changed since (server-computed stale flag)
const needsReview = s => !s.verdict || s.stale

function changeFilter(key, value) {
  filters[key] = value
  justActed = new Set()
  writeUrl()
  render()
}

function buildGroupOptions() {
  const sel = $('#group')
  const groups = [...new Set(data.map(s => nameGroup(s.name)))].sort()
  sel.innerHTML = '<option value="">All groups</option>' +
    groups.map(g => '<option value="' + g + '">' + g + '</option>').join('')
  // drop a restored group filter that no longer names an existing group
  if (!groups.includes(filters.group)) {
    filters.group = ''
  }
  sel.value = filters.group
}

async function load() {
  readUrl()
  data = await (await fetch('/api/specs')).json()
  buildGroupOptions()
  // canonicalize: drops a shared-URL group that no longer names a real group
  writeUrl()
  render()
}

function renderUsages(usages) {
  return usages.length
    ? '<div class="usages">' + usages.map(u =>
        '<div class="usage">' +
          '<div class="loc">' + esc(u.file) + ':' + u.line + '</div>' +
          (u.caption ? '<div class="caption">' + esc(u.caption) + '</div>' : '') +
        '</div>'
      ).join('') + '</div>'
    : '<div class="noref">⚠ not referenced in any doc / blog / gallery page</div>'
}

function kindPill(spec) {
  return spec.autogenerated
    ? pill('auto', 'autogenerated')
    : pill('manual', 'manual')
}

function imgCol(label, inner) {
  return '<div class="imgcol">' +
    '<div class="imglabel">' + label + '</div>' +
    '<div class="imgwrap">' + inner + '</div>' +
  '</div>'
}

function card(spec) {
  const v = spec.verdict
  const status = v ? v.status : 'none'
  const cls = spec.stale ? 'stale' : status
  const currentImg = spec.exists
    ? '<img src="/img/' + spec.name + '.png" onclick="window.open(this.src)" />'
    : '<div class="missing">⚠ image file missing — regenerate it</div>'
  const mainImg = spec.existsOnMain
    ? '<img src="/img-main/' + spec.name + '.png" onclick="window.open(this.src)" />'
    : '<div class="missing" style="color:#aaa">not on origin/main</div>'
  return '<div class="card ' + cls + '" data-name="' + esc(spec.name) + '" data-status="' + status + '">' +
    '<div class="card-images">' +
      imgCol('current branch', currentImg) +
      imgCol('origin/main', mainImg) +
    '</div>' +
    '<div class="meta">' +
      '<h2>' + esc(spec.name) + ' ' + kindPill(spec) +
        (spec.stale ? ' ' + pill('stale', 'image changed since ' + status) : '') +
        (isNew(spec) ? ' ' + pill('new', 'new') : '') +
        (isChanged(spec) ? ' ' + pill('changed', 'changed') : '') + '</h2>' +
      renderUsages(spec.usages) +
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
  const spec = data.find(s => s.name === name)
  if (spec) {
    // verdict was just recorded against the current image, so it's no longer stale
    spec.verdict = { name, status, note, reviewedAt: new Date().toISOString() }
    spec.stale = false
  }
  justActed.add(name)
  updateCard(name)
}

// Persist note edits on their own so a reason typed after Approve/Deny is saved
// without needing to click the button again. Deliberately does not re-render, so
// the input keeps focus while you type.
async function saveNote(input) {
  const name = cardEl(input).dataset.name
  const spec = data.find(s => s.name === name)
  if (spec && spec.verdict) {
    spec.verdict = { ...spec.verdict, note: input.value }
    await postVerdict(name, spec.verdict.status, input.value)
  }
}

async function clearVerdict(btn) {
  const name = cardEl(btn).dataset.name
  await fetch('/api/verdict/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  const spec = data.find(s => s.name === name)
  if (spec) {
    spec.verdict = undefined
    spec.stale = false
  }
  updateCard(name)
}

function syncControls() {
  for (const b of document.querySelectorAll('header [data-status]')) {
    b.classList.toggle('active', b.dataset.status === filters.status)
  }
  $('[data-toggle="changed"]').classList.toggle('active', filters.changedOnly)
  $('#sortby').value = filters.sortBy
  $('#kind').value = filters.kind
}

function renderCounts() {
  $('[data-count="needs"]').textContent = data.filter(needsReview).length
  $('[data-count="changed"]').textContent =
    data.filter(s => isNew(s) || isChanged(s)).length

  const good = data.filter(s => s.verdict?.status === 'good' && !s.stale).length
  const bad = data.filter(s => s.verdict?.status === 'bad' && !s.stale).length
  const stale = data.filter(s => s.stale).length
  $('#counts').innerHTML =
    pill('good', good + ' approved') +
    pill('bad', bad + ' denied') +
    (stale ? pill('stale', stale + ' changed since review') : '') +
    pill('none', data.filter(s => !s.verdict).length + ' unreviewed')
}

function matchesFilters(s, q) {
  const matchesQuery = !q || s.name.toLowerCase().includes(q)
  const matchesGroup = !filters.group || nameGroup(s.name) === filters.group
  const matchesKind =
    filters.kind === 'all' ||
    (filters.kind === 'manual' && !s.autogenerated) ||
    (filters.kind === 'auto' && s.autogenerated)
  const matchesStatus =
    filters.status === 'all' ||
    (filters.status === 'needs' && needsReview(s)) ||
    (filters.status === 'good' && s.verdict?.status === 'good' && !s.stale) ||
    (filters.status === 'bad' && s.verdict?.status === 'bad' && !s.stale)
  const matchesChanged = !filters.changedOnly || isNew(s) || isChanged(s)
  return matchesQuery && matchesGroup && matchesKind && (justActed.has(s.name) || (matchesStatus && matchesChanged))
}

function render() {
  syncControls()
  renderCounts()
  const q = $('#search').value.toLowerCase()
  let visible = data.filter(s => matchesFilters(s, q))
  if (filters.sortBy === 'recent') {
    visible = [...visible].sort((a, b) => {
      const ta = a.verdict ? new Date(a.verdict.reviewedAt).getTime() : 0
      const tb = b.verdict ? new Date(b.verdict.reviewedAt).getTime() : 0
      return tb - ta
    })
  }
  $('#main').innerHTML = visible.map(card).join('')
}

// Re-render a single card in place rather than rebuilding all of main, so
// acting on one card never wipes unsaved note text typed into other cards.
function updateCard(name) {
  const spec = data.find(s => s.name === name)
  const el = [...document.querySelectorAll('.card')].find(c => c.dataset.name === name)
  if (spec && el) {
    el.outerHTML = card(spec)
  }
  renderCounts()
}

$('header').addEventListener('click', e => {
  const statusBtn = e.target.closest('[data-status]')
  const toggleBtn = e.target.closest('[data-toggle]')
  if (statusBtn) {
    changeFilter('status', statusBtn.dataset.status)
  } else if (toggleBtn) {
    changeFilter('changedOnly', !filters.changedOnly)
  }
})
$('#search').addEventListener('input', () => {
  writeUrl()
  render()
})
$('#sortby').addEventListener('change', () => changeFilter('sortBy', $('#sortby').value))
$('#group').addEventListener('change', () => changeFilter('group', $('#group').value))
$('#kind').addEventListener('change', () => changeFilter('kind', $('#kind').value))
load()
</script>
</body>
</html>`
