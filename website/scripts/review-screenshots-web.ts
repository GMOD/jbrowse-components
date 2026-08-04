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
  updateReport,
  websiteRoot,
} from './screenshot-review-lib.ts'
import { screenshotLiveUrls, specs } from './screenshot-specs.ts'

import type { Verdict } from './screenshot-review-lib.ts'

const cliArgs = process.argv.slice(2)
const portArg = cliArgs.find(a => a.startsWith('--port='))
const portVal = portArg ? Number(portArg.split('=')[1]) : Number.NaN
const port = Number.isFinite(portVal) ? portVal : 3335

function buildSpecPayload() {
  const report = loadReport()
  return collectScreenshots(specs).map(shot => {
    const verdict = report[shot.name]
    // the hash of the PNG as the reviewer is about to see it. It rides along so
    // the page can say which pixels a verdict was formed against — both to
    // cache-bust the <img> and as the precondition on the write.
    const currentHash = imageHash(shot.name)
    // an approval/denial only resurfaces once the reviewed image changes
    const stale = isVerdictStale(verdict, currentHash)
    const liveUrl = screenshotLiveUrls[shot.name]
    // a compose figure has no session of its own; its parts carry the live
    // links, which is also what `<Figure links=...>` publishes for it
    return {
      ...shot,
      parts: shot.parts.map(part => ({
        ...part,
        liveUrl: screenshotLiveUrls[part.name],
      })),
      verdict,
      stale,
      imageHash: currentHash ?? null,
      ...(liveUrl ? { liveUrl } : {}),
    }
  })
}

// A verdict body is a name, a status and a note; a megabyte is already orders
// of magnitude more than the longest note anyone has typed.
const maxBodyBytes = 1024 * 1024

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => {
      data += chunk
      if (data.length > maxBodyBytes) {
        req.destroy()
        reject(new Error('request body too large'))
      }
    })
    req.on('end', () => {
      resolve(data)
    })
    // A request that errors or is aborted never fires 'end'. Without these the
    // promise stays pending for the life of the process, and an 'error' with no
    // listener is an unhandled error event that takes the server down — which,
    // if it lands mid-write, is exactly how the report gets truncated. 'close'
    // fires after 'end' too, but rejecting a settled promise is a no-op.
    req.on('error', reject)
    req.on('close', () => {
      reject(new Error('request closed before its body ended'))
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

// jb2export writes its renders to products/jbrowse-img/img (the README/npm
// copy); the website mirror at static/img/jbrowse-img is only refreshed by a
// `pnpm screenshots` (captureCliSpec) or `pnpm autogen` run. So a fresh
// jb2export the reviewer just produced can leave the review UI showing the stale
// mirror. Self-heal on read: for a `jbrowse-img/<name>` request, if the source
// render is newer than (or absent from) the mirror, copy it over before serving.
const jbrowseImgSrcDir = path.resolve(
  websiteRoot,
  '..',
  'products',
  'jbrowse-img',
  'img',
)

function syncJbrowseImgFromSource(rel: string, dest: string) {
  const name = rel.slice('jbrowse-img/'.length)
  const src = path.resolve(jbrowseImgSrcDir, name)
  if (!src.startsWith(jbrowseImgSrcDir + path.sep) || !fs.existsSync(src)) {
    return
  }
  const srcMtime = fs.statSync(src).mtimeMs
  const destFresh = fs.existsSync(dest) && fs.statSync(dest).mtimeMs >= srcMtime
  if (!destFresh) {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

// Serve /img/<name>.png, guarding against path traversal outside imgDir
function serveImage(res: http.ServerResponse, urlPath: string) {
  const rel = decodeURIComponent(urlPath.slice('/img/'.length))
  const full = path.resolve(imgDir, rel)
  if (full.startsWith(imgDir + path.sep) && rel.startsWith('jbrowse-img/')) {
    syncJbrowseImgFromSource(rel, full)
  }
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

// What the client had in hand when it composed the write: `ifReviewedAt` is the
// verdict's `reviewedAt` it last saw, `ifImageHash` the sha1 of the PNG it
// actually rendered. `null` means "there was none", and an absent field opts out
// of that check (curl and scripts, which have nothing stale to revert). Anything
// else is a malformed body rather than a silent opt-out.
type Precondition = string | null | undefined

function parsePrecondition(
  body: object,
  field: 'ifReviewedAt' | 'ifImageHash',
): { ok: true; value: Precondition } | { ok: false } {
  if (!(field in body)) {
    return { ok: true, value: undefined }
  }
  const v = (body as Record<string, unknown>)[field]
  return typeof v === 'string' || v === null
    ? { ok: true, value: v }
    : { ok: false }
}

function parseVerdictBody(raw: string):
  | {
      name: string
      status: 'good' | 'bad' | 'answered'
      note: string
      ifReviewedAt: Precondition
      ifImageHash: Precondition
    }
  | undefined {
  const body: unknown = JSON.parse(raw)
  const name = parseName(body)
  if (
    name === undefined ||
    typeof body !== 'object' ||
    body === null ||
    !('status' in body) ||
    (body.status !== 'good' &&
      body.status !== 'bad' &&
      body.status !== 'answered')
  ) {
    return undefined
  }
  const pre = parsePrecondition(body, 'ifReviewedAt')
  const img = parsePrecondition(body, 'ifImageHash')
  if (!pre.ok || !img.ok) {
    return undefined
  }
  const note = 'note' in body && typeof body.note === 'string' ? body.note : ''
  return {
    name,
    status: body.status,
    note,
    ifReviewedAt: pre.value,
    ifImageHash: img.value,
  }
}

function parseNameBody(
  raw: string,
): { name: string; ifReviewedAt: Precondition } | undefined {
  const body: unknown = JSON.parse(raw)
  const name = parseName(body)
  if (name === undefined || typeof body !== 'object' || body === null) {
    return undefined
  }
  const pre = parsePrecondition(body, 'ifReviewedAt')
  return pre.ok ? { name, ifReviewedAt: pre.value } : undefined
}

// True when the entry moved underneath the client since it loaded — another
// review server, flip-review.ts, a hand edit, a branch switch. Writing anyway
// would silently revert that change, which is what a page left open for an
// afternoon does every time its note textarea loses focus.
function isConflict(stored: Verdict | undefined, ifReviewedAt: Precondition) {
  return (
    ifReviewedAt !== undefined && (stored?.reviewedAt ?? null) !== ifReviewedAt
  )
}

// True when the PNG moved under the reviewer — a regen landed after their page
// rendered. The verdict precondition cannot see this: nothing about the verdict
// changed, only the picture it would be recorded against. Left unchecked, the
// reviewer approves the image they are looking at and the server stamps the
// hash of the one that replaced it, which reads afterwards as a considered
// approval of pixels nobody ever saw.
function isImageConflict(name: string, ifImageHash: Precondition) {
  return ifImageHash !== undefined && (imageHash(name) ?? null) !== ifImageHash
}

function sendConflict(
  res: http.ServerResponse,
  name: string,
  current: Verdict | undefined,
  reason: 'verdict' | 'image',
) {
  const hash = imageHash(name)
  sendJson(res, 409, {
    error: 'changed since your page loaded',
    reason,
    current: current ?? null,
    stale: isVerdictStale(current, hash),
    imageHash: hash ?? null,
  })
}

async function handleVerdict(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const parsed = parseVerdictBody(await readBody(req))
  if (!parsed) {
    sendJson(res, 400, { error: 'invalid verdict body' })
    return
  }
  const { ifReviewedAt, ifImageHash, ...fields } = parsed
  // The report is loaded, checked and written inside one lock: reading it out
  // here first would reopen the lost-update window the lock exists to close.
  // The image check belongs in here too — the PNG is hashed under the same lock
  // that stamps the hash, so a regen cannot slip between the two.
  const outcome = updateReport(report => {
    const stored = report[fields.name]
    if (isConflict(stored, ifReviewedAt)) {
      return { conflict: 'verdict' as const, current: stored }
    }
    if (isImageConflict(fields.name, ifImageHash)) {
      return { conflict: 'image' as const, current: stored }
    }
    const verdict: Verdict = {
      ...fields,
      reviewedAt: new Date().toISOString(),
      hash: imageHash(fields.name),
    }
    report[fields.name] = verdict
    return { conflict: false as const, verdict }
  })
  if (outcome.conflict) {
    sendConflict(res, fields.name, outcome.current, outcome.conflict)
  } else {
    sendJson(res, 200, outcome.verdict)
  }
}

async function handleClearVerdict(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  const parsed = parseNameBody(await readBody(req))
  if (!parsed) {
    sendJson(res, 400, { error: 'invalid body' })
    return
  }
  const { name, ifReviewedAt } = parsed
  const outcome = updateReport(report => {
    const stored = report[name]
    if (isConflict(stored, ifReviewedAt)) {
      return { conflict: true as const, current: stored }
    }
    delete report[name]
    return { conflict: false as const }
  })
  if (outcome.conflict) {
    sendConflict(res, name, outcome.current, 'verdict')
  } else {
    sendJson(res, 200, { name, cleared: true })
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
    padding: 12px 20px; display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap;
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
  /* answered reads as "in flight", so blue rather than the red of an open
     denial or the green of an approval — it is neither yet. */
  .pill.answered { background: #dbeafe; color: #1e3a8a; }
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
  .card.answered { border-left: 5px solid #3b82f6; }
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
  .livelink { font-size: 13px; color: LinkText; align-self: flex-start; }
  .parts { font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
  .parts > .partshead { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: GrayText; }
  .part { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .part .partname { font-family: ui-monospace, monospace; font-size: 12px; }
  .partstale { font-size: 13px; color: #b45309; }
  .actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  button { padding: 7px 14px; border-radius: 6px; border: 1px solid ButtonBorder; background: ButtonFace; color: ButtonText; cursor: pointer; font-size: 14px; }
  button.approve { border-color: #22c55e; color: #16a34a; }
  button.approve.active { background: #22c55e; color: #fff; }
  button.deny { border-color: #ef4444; color: #dc2626; }
  button.deny.active { background: #ef4444; color: #fff; }
  button.clear { border-color: ButtonBorder; color: GrayText; }
  .note { width: 100%; padding: 6px 9px; border: 1px solid ButtonBorder; border-radius: 6px; font-size: 13px; background: Field; color: FieldText; font-family: inherit; resize: vertical; }
  .reviewedAt { font-size: 11px; color: GrayText; }
  /* a write that did not land, or one rejected because the entry moved. Empty
     for the overwhelmingly common case where it just worked. */
  .cardmsg { font-size: 13px; font-weight: 500; }
  .cardmsg:empty { display: none; }
  .cardmsg.error { color: #b91c1c; }
  .cardmsg.warn { color: #b45309; }
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
    <button class="tab" data-status="answered">Answered<span class="tabcount" data-count="answered"></span></button>
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
// A compose figure counts as changed when a part it stacks changed, even if the
// stack itself wasn't recomposed — that gap is the bug the card warns about.
const isNew = s => s.exists && !s.existsOnMain
const isChanged = s => s.changed || s.parts.some(p => p.changed || isNew(p))
// parts moved but the published stack didn't: the figure on the site is stale
const partsAhead = s => !s.changed && !isNew(s) && isChanged(s)
// needs review when unreviewed, when its verdict went stale because the
// reviewed image changed since (server-computed stale flag), or when a denial
// has been answered and is waiting on your call. The third case is the one
// staleness cannot see: an answer that changed no pixels leaves the hash
// matching, so it is only 'answered' that puts it back in the queue.
const needsReview = s => !s.verdict || s.stale || s.verdict.status === 'answered'

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

// A compose figure's parts are its ingredients, not figures of their own: the
// card above already shows the stack they add up to, so they render as a list of
// live links (what <Figure links=...> publishes) rather than separate cards.
function renderParts(spec) {
  return spec.parts.length
    ? '<div class="parts">' +
        '<div class="partshead">stacked from</div>' +
        spec.parts.map(p =>
          '<div class="part">' +
            '<span class="partname">' + esc(p.name) + '</span>' +
            (p.exists ? '' : ' ' + pill('bad', 'image missing')) +
            (isNew(p) ? ' ' + pill('new', 'new') : '') +
            (p.changed ? ' ' + pill('changed', 'changed') : '') +
            (p.liveUrl ? ' <a href="' + esc(p.liveUrl) + '" target="_blank" rel="noopener">open live ↗</a>' : '') +
          '</div>'
        ).join('') +
        (partsAhead(spec)
          ? '<div class="partstale">⚠ a part changed but the stacked image did not — ' +
            'rerun <code>generate-screenshots --filter ' + esc(spec.name) + '</code></div>'
          : '') +
      '</div>'
    : ''
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
  // The hash rides in the URL so the browser refetches exactly when the pixels
  // change and caches otherwise. Without it a regen leaves the reviewer looking
  // at a cached image while judging the one now on disk.
  const currentImg = spec.exists
    ? '<img src="/img/' + spec.name + '.png?v=' + esc(spec.imageHash || '') + '" onclick="window.open(this.src)" />'
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
        (status === 'answered' ? ' ' + pill('answered', 'answered — reply in the note') : '') +
        (spec.stale ? ' ' + pill('stale', 'image changed since ' + status) : '') +
        (isNew(spec) ? ' ' + pill('new', 'new') : '') +
        (isChanged(spec) ? ' ' + pill('changed', 'changed') : '') + '</h2>' +
      renderUsages(spec.usages) +
      renderParts(spec) +
      (spec.liveUrl ? '<a class="livelink" href="' + esc(spec.liveUrl) + '" target="_blank" rel="noopener">Open live in JBrowse ↗</a>' : '') +
      '<textarea class="note" rows="2" placeholder="note (optional)" onchange="saveNote(this)">' + esc(v ? v.note : '') + '</textarea>' +
      '<div class="actions">' +
        '<button class="approve ' + (status === 'good' ? 'active' : '') + '" onclick="setVerdict(this,\\'good\\')">✓ Approve</button>' +
        '<button class="deny ' + (status === 'bad' ? 'active' : '') + '" onclick="setVerdict(this,\\'bad\\')">✗ Deny</button>' +
        (v ? '<button class="clear" onclick="clearVerdict(this)">clear</button>' : '') +
        (v ? '<span class="reviewedAt">' + new Date(v.reviewedAt).toLocaleString() + '</span>' : '') +
      '</div>' +
      '<div class="' + msgClass(spec.name) + '">' + esc(messageText(spec.name)) + '</div>' +
    '</div>' +
  '</div>'
}

const cardEl = btn => btn.closest('.card')
const cardOf = name =>
  [...document.querySelectorAll('.card')].find(c => c.dataset.name === name)

// Per-card outcome message: a write that failed, or one rejected because the
// entry moved on disk. Kept outside \`data\` so a re-render reproduces it.
const cardMessages = new Map()
const messageText = name => (cardMessages.get(name) || {}).text || ''
const msgClass = name =>
  'cardmsg' + (cardMessages.has(name) ? ' ' + cardMessages.get(name).kind : '')

function setMessage(name, text, kind) {
  if (text) {
    cardMessages.set(name, { text, kind })
  } else {
    cardMessages.delete(name)
  }
}

// Update the message in place, for the paths that must not re-render (a note
// textarea's own save — re-rendering there would put back the stored note and
// throw away what the reviewer just typed).
function paintMessage(name) {
  const el = cardOf(name)
  const box = el && el.querySelector('.cardmsg')
  if (box) {
    box.textContent = messageText(name)
    box.className = msgClass(name)
  }
}

// What this tab had in hand, sent with every write so the server can reject one
// composed against state that has since moved. null means "there was none",
// which is a precondition worth stating too: it catches a tab that would
// otherwise resurrect an entry another process deleted. The image hash is the
// half that matters most — it is what makes an approval mean "I looked at these
// pixels" rather than "I clicked while these pixels were the current ones".
const precondition = spec => (spec.verdict ? spec.verdict.reviewedAt : null)
const imgPrecondition = spec => spec.imageHash || null

// Never let a write that did not land look like one that did. Throws on
// failure; returns { conflict: true, ... } when the server refused because the
// entry changed underneath us.
async function readWriteResponse(res) {
  const body = await res.json().catch(() => null)
  if (res.status === 409) {
    return {
      conflict: true,
      reason: body ? body.reason : 'verdict',
      current: body && body.current ? body.current : undefined,
      stale: !!(body && body.stale),
      imageHash: body ? body.imageHash : null,
    }
  }
  if (!res.ok) {
    throw new Error((body && body.error) || 'HTTP ' + res.status)
  }
  return { conflict: false, body: body }
}

async function postJson(url, payload) {
  return readWriteResponse(await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }))
}

function postVerdict(spec, status, note) {
  return postJson('/api/verdict', {
    name: spec.name,
    status,
    note,
    ifReviewedAt: precondition(spec),
    ifImageHash: imgPrecondition(spec),
  })
}

// Take on what the server says is on disk, so the next write carries a
// precondition that will actually match. Adopting the image hash also swaps the
// <img> URL, so the re-render puts the new picture in front of the reviewer
// instead of leaving the old one cached in place.
function adoptRemote(spec, result) {
  spec.verdict = result.current
  spec.stale = result.stale
  spec.imageHash = result.imageHash
}

const conflictText = result =>
  result.reason === 'image'
    ? 'Not saved — this figure was regenerated since the page loaded, so the ' +
      'image you just judged is not the one on disk. The new one is above; ' +
      'look again before deciding.'
    : 'Not saved — this entry changed elsewhere since the page loaded (now: ' +
      (result.current ? result.current.status : 'cleared') +
      '). The card is back in sync; act again if you still want to.'

async function setVerdict(btn, status) {
  const el = cardEl(btn)
  const name = el.dataset.name
  const note = el.querySelector('.note').value
  const spec = data.find(s => s.name === name)
  if (!spec) {
    return
  }
  try {
    const result = await postVerdict(spec, status, note)
    if (result.conflict) {
      adoptRemote(spec, result)
      setMessage(name, conflictText(result), 'warn')
    } else {
      // adopt the server's own verdict: it carries the reviewedAt the next
      // write has to match and the image hash this tab cannot compute. It was
      // recorded against the current image, so it is not stale.
      spec.verdict = result.body
      spec.stale = false
      setMessage(name, '')
    }
  } catch (err) {
    setMessage(name, 'Not saved — ' + err.message, 'error')
  }
  justActed.add(name)
  updateCard(name)
}

// Persist note edits on their own so a reason typed after Approve/Deny is saved
// without needing to click the button again. Deliberately does not re-render:
// the reviewer's text stays exactly as they left it whatever the outcome.
async function saveNote(input) {
  const name = cardEl(input).dataset.name
  const spec = data.find(s => s.name === name)
  if (!spec) {
    return
  }
  if (!spec.verdict) {
    // a note has nothing to attach to until there is a verdict; say so rather
    // than dropping the words silently, as this used to
    setMessage(name, 'Note not saved yet — approve or deny and it goes with the verdict.', 'warn')
    paintMessage(name)
    return
  }
  // A note save carries the image precondition too, because the server restamps
  // the verdict's hash from the current PNG on every write: without it, typing a
  // note would quietly re-bless a figure that had been regenerated since, and
  // clear its 'changed since review' flag with nobody having looked.
  try {
    const result = await postVerdict(spec, spec.verdict.status, input.value)
    if (result.conflict) {
      adoptRemote(spec, result)
      setMessage(name, conflictText(result) + ' Your note text is still here — blur again to save it.', 'warn')
      // re-render on this path only: it swaps in the image that is actually on
      // disk, and updateCard carries the typed note across for us
      updateCard(name)
      return
    }
    spec.verdict = result.body
    setMessage(name, '')
  } catch (err) {
    setMessage(name, 'Note not saved — ' + err.message, 'error')
  }
  paintMessage(name)
}

async function clearVerdict(btn) {
  const name = cardEl(btn).dataset.name
  const spec = data.find(s => s.name === name)
  if (!spec) {
    return
  }
  try {
    const result = await postJson('/api/verdict/clear', {
      name,
      ifReviewedAt: precondition(spec),
    })
    if (result.conflict) {
      adoptRemote(spec, result)
      setMessage(name, conflictText(result), 'warn')
    } else {
      spec.verdict = undefined
      spec.stale = false
      setMessage(name, '')
    }
  } catch (err) {
    setMessage(name, 'Not cleared — ' + err.message, 'error')
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

  const answered = data.filter(s => s.verdict?.status === 'answered' && !s.stale).length
  $('[data-count="answered"]').textContent = answered

  const good = data.filter(s => s.verdict?.status === 'good' && !s.stale).length
  const bad = data.filter(s => s.verdict?.status === 'bad' && !s.stale).length
  const stale = data.filter(s => s.stale).length
  $('#counts').innerHTML =
    pill('good', good + ' approved') +
    pill('bad', bad + ' denied') +
    (answered ? pill('answered', answered + ' answered, awaiting you') : '') +
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
    (filters.status === 'bad' && s.verdict?.status === 'bad' && !s.stale) ||
    (filters.status === 'answered' && s.verdict?.status === 'answered' && !s.stale)
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
  const el = cardOf(name)
  if (spec && el) {
    // Carry the textarea's live value across the swap. On a write that landed
    // this is exactly what was saved anyway; on one that failed or conflicted
    // it is the difference between "try again" and losing the words typed.
    const typed = el.querySelector('.note').value
    el.outerHTML = card(spec)
    cardOf(name).querySelector('.note').value = typed
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
