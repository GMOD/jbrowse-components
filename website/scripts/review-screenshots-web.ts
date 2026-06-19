import fs from 'fs'
import http from 'http'
import path from 'path'

import {
  collectScreenshots,
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
  return collectScreenshots(specs).map(shot => ({
    ...shot,
    verdict: report[shot.name],
  }))
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
    const verdict: Verdict = { ...parsed, reviewedAt: new Date().toISOString() }
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
  try {
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(PAGE)
    } else if (url === '/api/specs') {
      sendJson(res, 200, buildSpecPayload())
    } else if (url === '/api/verdict' && req.method === 'POST') {
      handleVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (url === '/api/verdict/clear' && req.method === 'POST') {
      handleClearVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (url.startsWith('/img-main/')) {
      serveMainImage(res, url.split('?')[0]!)
    } else if (url.startsWith('/img/')) {
      serveImage(res, url.split('?')[0]!)
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
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    background: #f4f5f7;
    color: #1a1a1a;
  }
  header {
    position: sticky; top: 0; z-index: 10;
    background: #fff; border-bottom: 1px solid #ddd;
    padding: 12px 20px; display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
  }
  header h1 { font-size: 16px; margin: 0; }
  header input[type=search] { padding: 6px 10px; width: 220px; border: 1px solid #ccc; border-radius: 6px; }
  header label { font-size: 13px; display: flex; gap: 5px; align-items: center; cursor: pointer; }
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
  .pill.auto { background: #dbeafe; color: #1e40af; }
  .pill.curated { background: #fef3c7; color: #92400e; }
  .pill.manual { background: #f3e8ff; color: #6b21a8; }
  .pill.new { background: #cffafe; color: #155e63; }
  .pill.changed { background: #fde68a; color: #854d0e; }
  main { padding: 20px; display: flex; flex-direction: column; gap: 18px; max-width: 1400px; margin: 0 auto; }
  .card {
    background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;
  }
  .card.good { border-left: 5px solid #22c55e; }
  .card.bad { border-left: 5px solid #ef4444; }
  .card-images {
    display: flex; gap: 0;
  }
  .imgcol { flex: 1; display: flex; flex-direction: column; }
  .imglabel {
    font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 4px 10px; background: #f8f8f8; border-bottom: 1px solid #eee; color: #666;
  }
  .imgwrap { background: #222; display: flex; align-items: center; justify-content: center; min-height: 180px; flex: 1; }
  .imgwrap img { max-width: 100%; max-height: 400px; display: block; cursor: zoom-in; }
  .imgcol + .imgcol { border-left: 2px solid #ddd; }
  .missing { color: #f88; padding: 30px; font-size: 14px; }
  .meta { padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #eee; }
  .meta h2 { font-size: 14px; margin: 0; font-family: ui-monospace, monospace; word-break: break-all; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .usages { font-size: 13px; display: flex; flex-direction: column; gap: 8px; }
  .usage { border-left: 3px solid #cbd5e1; padding-left: 10px; }
  .usage .loc { font-family: ui-monospace, monospace; font-size: 12px; color: #2563eb; }
  .usage .caption { font-style: italic; margin-top: 2px; }
  .usage .context { color: #555; margin-top: 2px; }
  .noref { font-size: 13px; color: #b45309; }
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
  <h1>Screenshot review</h1>
  <div class="tabs">
    <button class="tab" data-page="automated">Automated<span class="tabcount" data-count="page-automated"></span></button>
    <button class="tab" data-page="manual">Manual<span class="tabcount" data-count="page-manual"></span></button>
  </div>
  <input id="search" type="search" placeholder="filter by name…" />
  <div class="tabs">
    <button class="tab" data-status="all">All</button>
    <button class="tab" data-status="unreviewed">Unreviewed</button>
    <button class="tab" data-status="bad">Denied</button>
  </div>
  <div class="tabs" title="compare against origin/main">
    <button class="tab" data-diff="all">All</button>
    <button class="tab" data-diff="new">New<span class="tabcount" data-count="diff-new"></span></button>
    <button class="tab" data-diff="changed">Changed<span class="tabcount" data-count="diff-changed"></span></button>
    <button class="tab" data-diff="touched">Both</button>
  </div>
  <div class="counts" id="counts"></div>
</header>
<main id="main"></main>
<script>
let data = []
const filters = { page: 'automated', status: 'all', diff: 'all' }
// Names acted on since the current filter view was entered. They stay visible
// even once their new verdict no longer matches the filter, so you can still
// type a reason after clicking Deny in the unreviewed/denied queue.
let justActed = new Set()

const $ = sel => document.querySelector(sel)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const pill = (cls, text) => '<span class="pill ' + cls + '">' + text + '</span>'

// Diff vs origin/main, the screenshots a branch review cares about:
// "new" = added on this branch (not on main); "changed" = on main but the
// working-tree pixels differ (an update). \`s.changed\` is computed server-side.
const isNew = s => s.exists && !s.existsOnMain
const isChanged = s => s.changed

function changeFilter(key, value) {
  filters[key] = value
  justActed = new Set()
  render()
}

async function load() {
  data = await (await fetch('/api/specs')).json()
  render()
}

function renderUsages(usages) {
  return usages.length
    ? '<div class="usages">' + usages.map(u =>
        '<div class="usage">' +
          '<div class="loc">' + esc(u.file) + ':' + u.line + '</div>' +
          (u.caption ? '<div class="caption">' + esc(u.caption) + '</div>' : '') +
          (u.context ? '<div class="context">' + esc(u.context) + '</div>' : '') +
        '</div>'
      ).join('') + '</div>'
    : '<div class="noref">⚠ not referenced in any doc / blog / gallery page</div>'
}

function kindPill(spec) {
  return spec.autogenerated
    ? pill('auto', 'autogenerated')
    : spec.hasSpec
      ? pill('curated', 'curated')
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
  const currentImg = spec.exists
    ? '<img src="/img/' + spec.name + '.png" onclick="window.open(this.src)" />'
    : '<div class="missing">⚠ image file missing — regenerate it</div>'
  const mainImg = spec.existsOnMain
    ? '<img src="/img-main/' + spec.name + '.png" onclick="window.open(this.src)" />'
    : '<div class="missing" style="color:#aaa">not on origin/main</div>'
  return '<div class="card ' + status + '" data-name="' + esc(spec.name) + '" data-status="' + status + '">' +
    '<div class="card-images">' +
      imgCol('current branch', currentImg) +
      imgCol('origin/main', mainImg) +
    '</div>' +
    '<div class="meta">' +
      '<h2>' + esc(spec.name) + ' ' + kindPill(spec) +
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
    spec.verdict = { name, status, note, reviewedAt: new Date().toISOString() }
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
  }
  updateCard(name)
}

const specsInPage = () =>
  data.filter(s => filters.page === 'automated' ? s.autogenerated : !s.autogenerated)

function syncControls() {
  for (const key of ['page', 'status', 'diff']) {
    for (const b of document.querySelectorAll('header [data-' + key + ']')) {
      b.classList.toggle('active', b.dataset[key] === filters[key])
    }
  }
}

function renderCounts() {
  const inPage = specsInPage()
  $('[data-count="page-automated"]').textContent = data.filter(s => s.autogenerated).length
  $('[data-count="page-manual"]').textContent = data.filter(s => !s.autogenerated).length
  $('[data-count="diff-new"]').textContent = inPage.filter(isNew).length
  $('[data-count="diff-changed"]').textContent = inPage.filter(isChanged).length

  const good = inPage.filter(s => s.verdict?.status === 'good').length
  const bad = inPage.filter(s => s.verdict?.status === 'bad').length
  const kindCounts = filters.page === 'automated'
    ? pill('auto', inPage.length + ' autogenerated')
    : pill('curated', inPage.filter(s => s.hasSpec && !s.autogenerated).length + ' curated') +
      pill('manual', inPage.filter(s => !s.hasSpec).length + ' manual')
  $('#counts').innerHTML =
    pill('good', good + ' approved') +
    pill('bad', bad + ' denied') +
    pill('none', (inPage.length - good - bad) + ' unreviewed') +
    kindCounts
}

function matchesFilters(s, q) {
  const matchesQuery = !q || s.name.toLowerCase().includes(q)
  const matchesStatus =
    filters.status === 'all' ||
    (filters.status === 'unreviewed' && !s.verdict) ||
    (filters.status === 'bad' && s.verdict?.status === 'bad')
  const matchesDiff =
    filters.diff === 'all' ||
    (filters.diff === 'new' && isNew(s)) ||
    (filters.diff === 'changed' && isChanged(s)) ||
    (filters.diff === 'touched' && (isNew(s) || isChanged(s)))
  return matchesQuery && (justActed.has(s.name) || (matchesStatus && matchesDiff))
}

function render() {
  syncControls()
  renderCounts()
  const q = $('#search').value.toLowerCase()
  const visible = specsInPage().filter(s => matchesFilters(s, q))
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
  const btn = e.target.closest('[data-page],[data-status],[data-diff]')
  if (btn) {
    const key = btn.dataset.page ? 'page' : btn.dataset.status ? 'status' : 'diff'
    changeFilter(key, btn.dataset[key])
  }
})
$('#search').addEventListener('input', render)
load()
</script>
</body>
</html>`
