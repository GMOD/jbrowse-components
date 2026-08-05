import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  createVerdictRoutes,
  isVerdictStale,
  reviewClientScript,
  sendJson,
} from '@jbrowse/browser-test-utils'

import {
  collectScreenshots,
  imageHash,
  imgDir,
  loadReport,
  readMainPng,
  refreshWorkingTreeScans,
  reportPath,
  syncJbrowseImgMirror,
  websiteRoot,
} from './screenshot-review-lib.ts'
import { screenshotLiveUrls, specs } from './screenshot-specs.ts'

const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    port: { type: 'string' },
  },
})

if (values.help) {
  console.log(`Review website screenshots in a web UI.

Usage: pnpm review-screenshots-web [--port=3335]

Each figure is shown against the same figure on origin/main, with where the
docs use it, and approve/deny/note controls. Verdicts are written to
${path.relative(process.cwd(), reportPath)}.
`)
  process.exit(0)
}

const portVal = values.port ? Number(values.port) : Number.NaN
const port = Number.isFinite(portVal) ? portVal : 3335

// Both image routes are content-addressed: the URL carries `?v=<hash of the
// bytes>`, so a URL can only ever mean one picture and is safe to cache
// forever. Without this the reviewer's loop — regenerate, RELOAD, look again —
// re-downloaded all ~600 images (~120MB, and a `git show` per origin/main one)
// on every single reload, because a bare 200 with no validators is not cacheable
// at all. A missing hash means we cannot name the bytes, so don't store them.
function cacheHeaders(hash: string | null) {
  return hash
    ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
    : { 'Cache-Control': 'no-store' }
}

function buildSpecPayload() {
  // Every load is a fresh look at the working tree. A review session is
  // regenerate, reload, look again, so the git and doc-usage scans behind
  // `changed`/`existsOnMain`/`usages` cannot be answered from what the tree
  // looked like when the server started.
  refreshWorkingTreeScans()
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

const contentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

function sendNotFound(res: http.ServerResponse) {
  res.writeHead(404)
  res.end('not found')
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

// Serve /img/<name>.png, guarding against path traversal outside imgDir
function serveImage(
  res: http.ServerResponse,
  urlPath: string,
  v: string | null,
) {
  const rel = decodePath(urlPath.slice('/img/'.length))
  const full = rel === undefined ? undefined : path.resolve(imgDir, rel)
  if (full === undefined || !full.startsWith(imgDir + path.sep)) {
    sendNotFound(res)
    return
  }
  // a jb2export the reviewer produced a minute ago is only in
  // products/jbrowse-img/img until something copies it across
  syncJbrowseImgMirror(full.slice(imgDir.length + 1).replace(/\.png$/, ''))
  if (!fs.existsSync(full)) {
    sendNotFound(res)
    return
  }
  res.writeHead(200, {
    'Content-Type':
      contentTypes[path.extname(full)] ?? 'application/octet-stream',
    ...cacheHeaders(v),
  })
  const stream = fs.createReadStream(full)
  // An unhandled stream 'error' is an uncaught exception that takes the whole
  // server down mid-review. The 200 is already out, so there is no status left
  // to send — drop the connection and let the <img> fail on its own.
  stream.on('error', () => {
    res.destroy()
  })
  stream.pipe(res)
}

// Serve /img-main/<name>.png from origin/main via git show
function serveMainImage(
  res: http.ServerResponse,
  urlPath: string,
  v: string | null,
) {
  const name = decodePath(urlPath.slice('/img-main/'.length))?.replace(
    /\.png$/,
    '',
  )
  const buf = name === undefined ? undefined : readMainPng(name)
  if (!buf) {
    sendNotFound(res)
  } else {
    res.writeHead(200, { 'Content-Type': 'image/png', ...cacheHeaders(v) })
    res.end(buf)
  }
}

const { handleVerdict, handleClearVerdict } = createVerdictRoutes({
  reportPath,
  hashOf: imageHash,
  // 'answered' has no button: flip-review.ts writes it, and the UI only posts
  // it back when a note is saved against an entry that is already in that
  // state. Rejecting it here would turn typing a note into a failed write.
  statuses: ['good', 'bad', 'answered'],
})

const server = http.createServer((req, res) => {
  const url = req.url ?? '/'
  const [rawPath, qs] = url.split('?')
  const pathname = rawPath!
  // the image routes are cacheable exactly when the URL names which bytes it
  // wants; `?v=` is that name
  const v = new URLSearchParams(qs ?? '').get('v') || null
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
      serveMainImage(res, pathname, v)
    } else if (pathname.startsWith('/img/')) {
      serveImage(res, pathname, v)
    } else {
      sendNotFound(res)
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

// Several agents share this worktree and the port is fixed, so "address in use"
// is a routine collision rather than a crash worth a stack trace.
server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `port ${port} is already in use — a review server is likely already ` +
        `running. Open it, or pass --port=<n> to start a second one.`,
    )
    process.exit(1)
  }
  throw err
})

server.listen(port, () => {
  console.log(`Screenshot review UI: http://localhost:${port}`)
  console.log(`Writing verdicts to: ${path.relative(websiteRoot, reportPath)}`)
})

// The write protocol and the note-draft bookkeeping are shared with jbrowse-web's
// browser-test snapshot review; this page supplies the two halves that differ —
// what a card looks like and what the header counts.
const CLIENT = reviewClientScript({
  draftsKey: 'screenshot-review-drafts',
  imageMovedPhrase: 'this figure was regenerated',
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
  /* height is set by the client's autosizeNote as you type; min-height keeps an
     empty box the two rows it was, and overflow-y lets it scroll once it hits
     the cap rather than clipping. No resize handle: autosize owns the height,
     so a dragged box snapped back on the next keystroke — a control that
     undoes itself is worse than no control. */
  .note { width: 100%; min-height: 3.6em; padding: 6px 9px; border: 1px solid ButtonBorder; border-radius: 6px; font-size: 13px; background: Field; color: FieldText; font-family: inherit; resize: none; overflow-y: auto; }
  .reviewedAt { font-size: 11px; color: GrayText; }
  /* a write that did not land, or one rejected because the entry moved. Empty
     for the overwhelmingly common case where it just worked. */
  .cardmsg { font-size: 13px; font-weight: 500; }
  .cardmsg:empty { display: none; }
  .cardmsg.error { color: #b91c1c; }
  .cardmsg.warn { color: #b45309; }
  /* whether what is in the note box has reached the report yet */
  .unsaved { font-size: 12px; font-weight: 500; color: #b45309; }
  .unsaved:empty { display: none; }
  .loaderror { color: #b91c1c; font-size: 14px; line-height: 1.5; white-space: pre-wrap; }
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
${CLIENT}

const filters = { status: 'needs', changedOnly: false, sortBy: 'default', group: '', kind: 'all' }

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

// A value only restores if it still names something the UI can show. A typo or
// a stale bookmark otherwise leaves every card filtered out and no control
// looking active — a blank page that reads as "nothing to review".
const STATUSES = ['needs', 'good', 'answered', 'bad', 'all']
const KINDS = ['all', 'manual', 'auto']
const SORTS = ['default', 'recent']

function readUrl() {
  const params = new URLSearchParams(location.search)
  const status = params.get('status')
  if (STATUSES.includes(status)) filters.status = status
  filters.changedOnly = params.get('changed') === '1'
  const sort = params.get('sort')
  if (SORTS.includes(sort)) filters.sortBy = sort
  const group = params.get('group')
  if (group) filters.group = group
  const kind = params.get('kind')
  if (KINDS.includes(kind)) filters.kind = kind
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
  clearJustActed()
  writeUrl()
  render()
}

function buildGroupOptions() {
  const sel = $('#group')
  const groups = [...new Set(data.map(s => nameGroup(s.name)))].sort()
  sel.innerHTML = '<option value="">All groups</option>' +
    groups.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('')
  // drop a restored group filter that no longer names an existing group
  if (!groups.includes(filters.group)) {
    filters.group = ''
  }
  sel.value = filters.group
}

async function load() {
  readUrl()
  try {
    const res = await fetch('/api/specs')
    const body = await res.json()
    if (!res.ok || !Array.isArray(body)) {
      throw new Error((body && body.error) || 'HTTP ' + res.status)
    }
    data = body
  } catch (err) {
    // Say why. The report being unparseable is a real case with real recovery
    // instructions in the message (loadReport writes them), and swallowing this
    // left an empty page that looked like a review with nothing left to do.
    $('#main').innerHTML =
      '<div class="loaderror">Could not load the screenshot list.\\n\\n' +
      esc(err.message) + '</div>'
    return
  }
  dropStaleDrafts()
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

// the shared review client calls this to rebuild one card in place
function renderCard(spec) {
  const v = spec.verdict
  const status = v ? v.status : 'none'
  const cls = spec.stale ? 'stale' : status
  // The hash rides in the URL so the browser refetches exactly when the pixels
  // change and caches otherwise. Without it a regen leaves the reviewer looking
  // at a cached image while judging the one now on disk.
  const currentImg = spec.exists
    ? '<img src="/img/' + spec.name + '.png?v=' + esc(spec.imageHash || '') + '" onclick="window.open(this.src)" />'
    : '<div class="missing">⚠ image file missing — regenerate it</div>'
  // the origin/main side carries its git blob sha for the same reason: a URL
  // that names its bytes is cacheable forever, and still refetches by itself if
  // origin/main moves under a session
  const mainImg = spec.existsOnMain
    ? '<img src="/img-main/' + spec.name + '.png?v=' + esc(spec.mainHash || '') + '" onclick="window.open(this.src)" />'
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
      // the leading newline is eaten by the HTML parser, so a note that opens
      // with a blank line round-trips without it unless one is spent here
      '<textarea class="note" rows="2" placeholder="note (optional)" onchange="saveNote(this)">\\n' + esc(v ? v.note : '') + '</textarea>' +
      '<div class="unsaved">' + esc(draftHint(spec)) + '</div>' +
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

function syncControls() {
  for (const b of document.querySelectorAll('header [data-status]')) {
    b.classList.toggle('active', b.dataset.status === filters.status)
  }
  $('[data-toggle="changed"]').classList.toggle('active', filters.changedOnly)
  $('#sortby').value = filters.sortBy
  $('#kind').value = filters.kind
  // group belongs here with the other two rather than only in
  // buildGroupOptions: it is the one control whose options are built from the
  // data, so it is the one most likely to be reset out from under the filters
  $('#group').value = filters.group
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
  harvestNotes()
  $('#main').innerHTML = visible.map(renderCard).join('')
  applyPendingNotes()
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
