/* eslint-disable no-console */
import fs from 'fs'
import http from 'http'
import path from 'path'

import {
  findUsages,
  imgDir,
  loadReport,
  reportPath,
  saveReport,
  websiteRoot,
} from './screenshot-review-lib.ts'
import { specs } from './screenshot-specs.ts'
import type { Verdict } from './screenshot-review-lib.ts'

const cliArgs = process.argv.slice(2)
const portArg = cliArgs.find(a => a.startsWith('--port='))
const port = portArg ? parseInt(portArg.split('=')[1]!, 10) : 3335

function buildSpecPayload() {
  const report = loadReport()
  return specs.map(spec => {
    const { name } = spec
    const imgPath = path.join(imgDir, `${name}.png`)
    return {
      name,
      exists: fs.existsSync(imgPath),
      usages: findUsages(name),
      verdict: report[name],
    }
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
  if (!full.startsWith(imgDir) || !fs.existsSync(full)) {
    res.writeHead(404)
    res.end('not found')
  } else {
    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(full)] ?? 'application/octet-stream',
    })
    fs.createReadStream(full).pipe(res)
  }
}

async function handleVerdict(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const body = JSON.parse(await readBody(req)) as {
    name: string
    status: 'good' | 'bad'
    note?: string
  }
  const report = loadReport()
  const verdict: Verdict = {
    name: body.name,
    status: body.status,
    note: body.note ?? '',
    reviewedAt: new Date().toISOString(),
  }
  report[body.name] = verdict
  saveReport(report)
  sendJson(res, 200, verdict)
}

async function handleClearVerdict(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const body = JSON.parse(await readBody(req)) as { name: string }
  const report = loadReport()
  if (report[body.name]) {
    delete report[body.name]
    saveReport(report)
  }
  sendJson(res, 200, { name: body.name, cleared: true })
}

const server = http.createServer((req, res) => {
  const url = req.url ?? '/'
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(PAGE)
  } else if (url === '/api/specs') {
    sendJson(res, 200, buildSpecPayload())
  } else if (url === '/api/verdict' && req.method === 'POST') {
    handleVerdict(req, res).catch(err => sendJson(res, 500, { error: `${err}` }))
  } else if (url === '/api/verdict/clear' && req.method === 'POST') {
    handleClearVerdict(req, res).catch(err =>
      sendJson(res, 500, { error: `${err}` }),
    )
  } else if (url.startsWith('/img/')) {
    serveImage(res, url.split('?')[0]!)
  } else {
    res.writeHead(404)
    res.end('not found')
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
  header label { font-size: 13px; display: flex; gap: 5px; align-items: center; }
  .counts { font-size: 13px; color: #555; margin-left: auto; display: flex; gap: 14px; }
  .counts b { font-weight: 600; }
  .pill { padding: 1px 8px; border-radius: 999px; font-size: 12px; }
  .pill.good { background: #d6f5dd; color: #14532d; }
  .pill.bad { background: #fbd9d9; color: #7f1d1d; }
  .pill.none { background: #eee; color: #666; }
  main { padding: 20px; display: flex; flex-direction: column; gap: 18px; max-width: 1100px; margin: 0 auto; }
  .card {
    background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; overflow: hidden;
    display: grid; grid-template-columns: 1fr 1fr;
  }
  .card.good { border-left: 5px solid #22c55e; }
  .card.bad { border-left: 5px solid #ef4444; }
  .card.hidden { display: none; }
  .imgwrap { background: #222; display: flex; align-items: center; justify-content: center; min-height: 240px; }
  .imgwrap img { max-width: 100%; max-height: 460px; display: block; cursor: zoom-in; }
  .missing { color: #f88; padding: 30px; font-size: 14px; }
  .meta { padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
  .meta h2 { font-size: 15px; margin: 0; font-family: ui-monospace, monospace; word-break: break-all; }
  .usages { font-size: 13px; display: flex; flex-direction: column; gap: 10px; }
  .usage { border-left: 3px solid #cbd5e1; padding-left: 10px; }
  .usage .loc { font-family: ui-monospace, monospace; font-size: 12px; color: #2563eb; }
  .usage .caption { font-style: italic; margin-top: 2px; }
  .usage .context { color: #555; margin-top: 2px; }
  .noref { font-size: 13px; color: #b45309; }
  .actions { display: flex; gap: 8px; align-items: center; margin-top: auto; flex-wrap: wrap; }
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
  <input id="search" type="search" placeholder="filter by name…" />
  <label><input id="onlyUnreviewed" type="checkbox" /> only unreviewed</label>
  <label><input id="onlyBad" type="checkbox" /> only denied</label>
  <div class="counts" id="counts"></div>
</header>
<main id="main"></main>
<script>
let data = []

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

async function load() {
  data = await (await fetch('/api/specs')).json()
  render()
}

function renderUsages(usages) {
  if (!usages.length) {
    return '<div class="noref">⚠ not referenced in any doc / blog / gallery page</div>'
  }
  return '<div class="usages">' + usages.map(u =>
    '<div class="usage">' +
      '<div class="loc">' + esc(u.file) + ':' + u.line + '</div>' +
      (u.caption ? '<div class="caption">' + esc(u.caption) + '</div>' : '') +
      (u.context ? '<div class="context">' + esc(u.context) + '</div>' : '') +
    '</div>'
  ).join('') + '</div>'
}

function card(spec) {
  const v = spec.verdict
  const status = v ? v.status : 'none'
  const img = spec.exists
    ? '<img src="/img/' + spec.name + '.png" onclick="window.open(this.src)" />'
    : '<div class="missing">⚠ image file missing — regenerate it</div>'
  return '<div class="card ' + status + '" data-name="' + esc(spec.name) + '" data-status="' + status + '">' +
    '<div class="imgwrap">' + img + '</div>' +
    '<div class="meta">' +
      '<h2>' + esc(spec.name) + '</h2>' +
      renderUsages(spec.usages) +
      '<input class="note" placeholder="note (optional)" value="' + esc(v ? v.note : '') + '" />' +
      '<div class="actions">' +
        '<button class="approve ' + (status === 'good' ? 'active' : '') + '" onclick="setVerdict(this,\\'good\\')">✓ Approve</button>' +
        '<button class="deny ' + (status === 'bad' ? 'active' : '') + '" onclick="setVerdict(this,\\'bad\\')">✗ Deny</button>' +
        (v ? '<button class="clear" onclick="clearVerdict(this)">clear</button>' : '') +
        (v ? '<span class="reviewedAt">' + new Date(v.reviewedAt).toLocaleString() + '</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>'
}

function cardEl(btn) { return btn.closest('.card') }

async function setVerdict(btn, status) {
  const el = cardEl(btn)
  const name = el.dataset.name
  const note = el.querySelector('.note').value
  await fetch('/api/verdict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, status, note }),
  })
  const spec = data.find(s => s.name === name)
  spec.verdict = { name, status, note, reviewedAt: new Date().toISOString() }
  render()
}

async function clearVerdict(btn) {
  const name = cardEl(btn).dataset.name
  await fetch('/api/verdict/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  data.find(s => s.name === name).verdict = undefined
  render()
}

function render() {
  const q = document.getElementById('search').value.toLowerCase()
  const onlyUnreviewed = document.getElementById('onlyUnreviewed').checked
  const onlyBad = document.getElementById('onlyBad').checked
  const good = data.filter(s => s.verdict?.status === 'good').length
  const bad = data.filter(s => s.verdict?.status === 'bad').length
  const none = data.length - good - bad
  document.getElementById('counts').innerHTML =
    '<span class="pill good">' + good + ' approved</span>' +
    '<span class="pill bad">' + bad + ' denied</span>' +
    '<span class="pill none">' + none + ' unreviewed</span>'

  const visible = data.filter(s => {
    if (q && !s.name.toLowerCase().includes(q)) { return false }
    if (onlyUnreviewed && s.verdict) { return false }
    if (onlyBad && s.verdict?.status !== 'bad') { return false }
    return true
  })
  document.getElementById('main').innerHTML = visible.map(card).join('')
}

for (const id of ['search', 'onlyUnreviewed', 'onlyBad']) {
  document.getElementById(id).addEventListener('input', render)
}
load()
</script>
</body>
</html>`
