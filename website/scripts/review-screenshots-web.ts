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

import { readManifest, unpublishedFigures } from './figure-paths.ts'
import { figureName, figurePath } from './figure-store.ts'
import { type RunReport, runReportPath } from './screenshot-report.ts'
import {
  collectScreenshots,
  getBaselineState,
  getWorktreeState,
  imageHash,
  imgDir,
  loadReport,
  refreshWorkingTreeScans,
  reportPath,
  syncJbrowseImgMirror,
  websiteDir,
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

// The image route is content-addressed: the URL carries `?v=<hash of the
// bytes>`, so a URL can only ever mean one picture and is safe to cache
// forever. Without this the reviewer's loop — regenerate, RELOAD, look again —
// re-downloaded every image (~70MB) on every single reload, because a bare 200
// with no validators is not cacheable at all. A missing hash means we cannot
// name the bytes, so don't store them.
//
// The baseline side needs nothing here: it is a store URL, already immutable and
// already served with a year of cache by CloudFront.
function cacheHeaders(hash: string | null) {
  return hash
    ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
    : { 'Cache-Control': 'no-store' }
}

function buildSpecPayload() {
  // Every load is a fresh look at the working tree. A review session is
  // regenerate, reload, look again, so the store and doc-usage scans behind
  // `changed`/`mainUrl`/`usages` cannot be answered from what the tree looked
  // like when the server started. Everything below reads through that one scan.
  refreshWorkingTreeScans()
  const report = loadReport()
  // Figure bytes live in the S3 store, so what a reviewer sees here is the file
  // on THIS disk, which is not necessarily what anyone else or the published
  // site gets. An unpushed regen is invisible to git, so without this a verdict
  // could be recorded against pixels nobody else will ever see.
  //
  // Kept as paths, like the unpulled set: figureName conflates the 27 mirrored
  // jb2export figures, so a name-keyed set marks a card unpushed because the
  // OTHER file of that name is. They travel together today — the mirror is a
  // byte copy, so both sides go stale on the same jb2export — which is exactly
  // why a name-keyed version of this would read as correct indefinitely.
  const unpublished = new Set(unpublishedFigures(getWorktreeState()))
  const runStates = specRunStates(loadRunReport())
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
      unpublished: unpublished.has(figurePath(shot.name)),
      // undefined when the last run never touched this spec, which the UI
      // draws as "not covered" rather than as passing
      run: runStates.get(shot.name),
      imageHash: currentHash ?? null,
      ...(liveUrl ? { liveUrl } : {}),
    }
  })
}

// The store state for the banner. Separate from /api/specs because the count
// includes figures no spec produces — a hand-made diagram dropped into
// static/img is exactly the kind that goes unpushed — and the banner should
// report the whole store, not the part that happens to have a spec.
//
// It reads the scan /api/specs just took rather than repeating it. Hashing the
// 62 MB of figures on disk is the most expensive thing either endpoint does, and
// doing it twice per page load bought nothing: the client fetches this straight
// after the spec list, off the same worktree.
function buildFigureStatePayload() {
  const state = getWorktreeState()
  const run = loadRunReport()
  return {
    unpublished: unpublishedFigures(state).map(figureName),
    unpulled: state.missing.map(figureName),
    total: readManifest().size,
    // which origin/main the whole "new"/"changed" column is against. Reads off
    // the same memoized baseline /api/specs just used, so it costs a `git log -1`
    // and not a second parse of the manifest.
    baseline: getBaselineState(),
    run: run && {
      finishedAt: run.finishedAt,
      filter: run.filter,
      check: run.check,
      failed: run.failures.length,
      flaky: run.flaky.length,
    },
  }
}

// What the last sweep noticed, keyed by spec name. Re-read per request for the
// same reason the working-tree scans are: the loop is regenerate, reload, look
// again, and a report cached at server start describes the run before the one
// you just did.
//
// Absent is a real answer and is kept distinct from "fine". A spec the last run
// did not touch — because the run was filtered, or predates the spec — has no
// verdict here, and the UI must not draw it as passing.
function loadRunReport(): RunReport | undefined {
  try {
    return JSON.parse(fs.readFileSync(runReportPath, 'utf8')) as RunReport
  } catch {
    return undefined
  }
}

interface SpecRunState {
  failed?: string
  flaky?: number
  updated?: string
  suppressed?: number
  covered: boolean
}

function specRunStates(run: RunReport | undefined) {
  const byName = new Map<string, SpecRunState>()
  if (!run) {
    return byName
  }
  const touch = (name: string) => {
    let s = byName.get(name)
    if (!s) {
      s = { covered: true }
      byName.set(name, s)
    }
    return s
  }
  for (const f of run.failures) {
    touch(f.name).failed = f.error
  }
  for (const f of run.flaky) {
    touch(f.name).flaky = f.frac
  }
  for (const u of run.updated) {
    touch(u.name).updated = u.detail
  }
  for (const s of run.suppressed) {
    touch(s.name).suppressed = s.frac
  }
  return byName
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
    } else if (pathname === '/api/figure-state') {
      sendJson(res, 200, buildFigureStatePayload())
    } else if (pathname === '/api/verdict' && req.method === 'POST') {
      handleVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (pathname === '/api/verdict/clear' && req.method === 'POST') {
      handleClearVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
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
  console.log(`Writing verdicts to: ${path.relative(websiteDir, reportPath)}`)
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
<!-- inline, both to stop the /favicon.ico 404 putting a red line in the console
     on every load and to tell this tab apart from the snapshot review UI, which
     the two tools are expected to be open beside -->
<link rel="icon" href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🖼️</text></svg>'>
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
  .pill.unpublished { background: #ffe4d5; color: #7c2d12; }
  /* A spec that failed to render is the most consequential thing on a card —
     the image below it is whatever the last successful run left, which looks
     exactly like a current figure. Red, and louder than the verdict pills. */
  .pill.failed { background: #fbd9d9; color: #7f1d1d; font-weight: 700; }
  .pill.flaky { background: #ede9fe; color: #5b21b6; }
  .pill.notcovered { background: #f1f5f9; color: #64748b; }
  .runerr { margin: 6px 0 0; padding: 8px 10px; border-radius: 6px; background: #fbd9d9; color: #7f1d1d; font-size: 12px; white-space: pre-wrap; font-family: ui-monospace, monospace; max-height: 9em; overflow: auto; }
  /* Says the answer either way. A reviewer needs to know that what they are
     approving is what everyone else will get, and silence cannot say that. */
  #store { padding: 8px 14px; font-size: 13px; border-bottom: 1px solid ButtonBorder; }
  #store.ok { background: #d6f5dd; color: #14532d; }
  #store.pending { background: #ffe4d5; color: #7c2d12; }
  #store code { background: rgba(0,0,0,.08); padding: 1px 5px; border-radius: 4px; }
  #store .names { margin-top: 4px; font-size: 12px; opacity: .85; }
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
    <button class="tab" data-status="good">Approved<span class="tabcount" data-count="good"></span></button>
    <button class="tab" data-status="answered">Answered<span class="tabcount" data-count="answered"></span></button>
    <button class="tab" data-status="bad">Denied<span class="tabcount" data-count="bad"></span></button>
    <button class="tab" data-status="all">All</button>
  </div>
  <button class="tab" data-toggle="changed" title="only screenshots new or changed vs origin/main">Changed vs main<span class="tabcount" data-count="changed"></span></button>
  <button class="tab" data-toggle="run" title="only specs the last run failed to render, rendered differently twice, or kept behind a raised diffThreshold">Render problems<span class="tabcount" data-count="run"></span></button>
  <div class="counts" id="counts"></div>
</header>
<div id="store"></div>
<main id="main"></main>
<script>
${CLIENT}

const filters = { status: 'needs', changedOnly: false, runOnly: false, sortBy: 'default', group: '', kind: 'all' }

// The last run's summary, filled by loadStoreState. Null until it arrives (and
// if it never does), which runPills reads to tell "no run" from "not covered".
let runInfo = null

// A spec the last run could not render, rendered differently twice, or only
// kept because its own diffThreshold was raised. All three mean the image on
// the card is not simply "what the app produces now".
const hasRunProblem = s =>
  !!s.run && (s.run.failed || s.run.flaky !== undefined || s.run.suppressed !== undefined)

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
  if (filters.runOnly) params.set('problems', '1')
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
  filters.runOnly = params.get('problems') === '1'
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
// "new" = added on this branch (not named by figures.lock on main); "changed" =
// named there but the bytes on disk differ (an update). \`s.changed\` is computed
// server-side against the store hashes. A compose figure counts as changed when
// a part it stacks changed, even if the stack itself wasn't recomposed — that
// gap is the bug the card warns about.
const isNew = s => s.exists && !s.mainUrl
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
  loadStoreState()
}

// Whether the figures on this disk are the figures everyone else gets.
//
// This says so in both directions on purpose. A reviewer approving a figure is
// approving pixels, and since figure bytes are gitignored there is otherwise
// nothing on screen distinguishing "published" from "only exists here" — the
// old world had \`git status\` for that. A silent banner would leave the good
// case indistinguishable from a banner that failed to render.
//
// Fetched after render() rather than blocking it: a review page that took an
// extra beat to appear because it was hashing 62 MB would be a bad trade.
async function loadStoreState() {
  const el = $('#store')
  try {
    const res = await fetch('/api/figure-state')
    const s = await res.json()
    if (!res.ok) throw new Error(s && s.error || 'HTTP ' + res.status)
    runInfo = s.run || null
    const parts = []
    if (!s.unpublished.length) {
      parts.push('All ' + s.total + ' figures are published to the store — what you see here is what everyone gets.')
    } else {
      parts.push('<strong>' + s.unpublished.length + ' figure(s) exist only on this machine.</strong> ' +
        'Run <code>pnpm figures:push</code> and commit <code>figures.lock</code>, or they are silently dropped — ' +
        'a verdict recorded now is against pixels nobody else will see.' +
        '<div class="names">' + s.unpublished.map(esc).join(', ') + '</div>')
    }
    // The mirror image of that, and just as invisible to git: figures.lock names
    // a figure whose bytes were never fetched here. Those cards have no picture
    // at all, which reads as a broken figure rather than an unfinished pull.
    if (s.unpulled.length) {
      parts.push('<strong>' + s.unpulled.length + ' figure(s) in <code>figures.lock</code> are not on this disk.</strong> ' +
        'Run <code>pnpm figures:pull</code> — their cards are blank until you do.' +
        '<div class="names">' + s.unpulled.map(esc).join(', ') + '</div>')
    }
    parts.push(describeBaseline(s.baseline))
    parts.push(describeRun(s.run))
    el.className =
      s.unpublished.length || s.unpulled.length || !s.baseline.found || (s.run && s.run.failed) ? 'pending' : 'ok'
    el.innerHTML = parts.join('<div class="names"></div>')
    render()
  } catch (err) {
    el.className = 'pending'
    el.textContent = 'Could not read the figure store state: ' + err.message
  }
}

function agoText(iso) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3600000
  return hours < 1 ? 'less than an hour ago'
    : hours < 48 ? Math.round(hours) + 'h ago'
    : Math.round(hours / 24) + ' days ago'
}

// Which origin/main every "new" and "changed" pill on this page is against.
//
// Two things only git knows and the cards cannot show. First, whether there is
// a baseline at all: with no figures.lock at the ref, every figure reads "new"
// and "Changed vs main" selects all of them — which looks exactly like a branch
// that added everything, and was the shape of the bug this page had for months.
// Second, how old it is: a remote-tracking ref is only as fresh as the last
// fetch, so an unfetched checkout compares against a baseline that still calls
// itself main.
function describeBaseline(b) {
  if (!b.found) {
    return '<strong>No <code>figures.lock</code> at <code>' + esc(b.ref) + '</code>, so there is no baseline.</strong> ' +
      'Every figure below is drawn as new and <em>Changed vs main</em> selects all of them — that is this page ' +
      'having nothing to compare against, not a fact about your branch. <code>git fetch origin</code>.'
  }
  const at = b.commit
    ? ' at <code>' + esc(b.commit) + '</code>' + (b.date ? ', ' + agoText(b.date) : '')
    : ''
  return 'Compared against <code>' + esc(b.ref) + '</code>' + at + ' — ' + b.figures + ' figures. ' +
    'It is only as fresh as your last <code>git fetch</code>.'
}

// The last sweep, in one line. Says when, because a week-old run describes a
// week-old app; says what it covered, because a --filter run is silent about
// everything else; and says whether flakiness was even tested for, since only
// --check can answer that and "0 flaky" from a normal run means "not measured".
function describeRun(r) {
  if (!r) {
    return 'No sweep has run on this machine, so no figure here carries a render verdict. ' +
      '<code>pnpm screenshots</code> writes one.'
  }
  const ago = agoText(r.finishedAt)
  const scope = r.filter.length
    ? 'filtered to <code>' + r.filter.map(esc).join(',') + '</code>'
    : 'a full sweep'
  const bits = ['Last run ' + ago + ', ' + scope + '.']
  if (r.failed) bits.push('<strong>' + r.failed + ' spec(s) failed to render</strong> — their cards show the last image that worked.')
  bits.push(r.check
    ? r.flaky + ' nondeterministic.'
    : 'Nondeterminism not measured (only <code>--check</code> tests for it).')
  return bits.join(' ')
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

// What the last sweep had to say about this spec.
//
// The failure pill matters most: when a spec dies, the PNG on the card is
// whatever the last SUCCESSFUL run left behind, and nothing else on screen
// distinguishes that from a current figure. A reviewer could approve a figure
// the app stopped being able to produce.
//
// "not covered" is drawn rather than left blank, because blank reads as fine.
// It means the last run was filtered past this spec (or predates it), so the
// card carries no evidence either way. Only autogenerated specs get it — a
// manual figure has no spec to run.
function runPills(spec) {
  const r = spec.run
  if (!r) {
    return spec.autogenerated && runInfo && runInfo.filter.length
      ? ' ' + pill('notcovered', 'not in the last run')
      : ''
  }
  var out = ''
  if (r.failed) out += ' ' + pill('failed', '✗ failed to render')
  if (r.flaky !== undefined)
    out += ' ' + pill('flaky', 'nondeterministic — ' + (r.flaky * 100).toFixed(2) + '% between two renders')
  if (r.suppressed !== undefined)
    out += ' ' + pill('flaky', 'kept behind a raised diffThreshold (' + (r.suppressed * 100).toFixed(2) + '%)')
  return out
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
            (p.exists ? '' : ' ' + (p.unpulled
              ? pill('bad', 'not pulled')
              : pill('bad', 'image missing'))) +
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
    // Two different holes with two different fixes. figures.lock naming a figure
    // this checkout has not fetched is the ordinary one — the bytes are in the
    // store and a regen would be wasted work.
    : spec.unpulled
      ? '<div class="missing">⚠ not on this machine — <code>pnpm figures:pull</code></div>'
      : '<div class="missing">⚠ no image and nothing in the store — regenerate it</div>'
  // Straight at the store. The URL is the baseline figure's content hash, so it
  // is immutable, public and cached for a year by CloudFront — nothing for this
  // server to proxy, and the link keeps resolving from any commit's manifest,
  // which is what makes it worth pasting into an issue.
  const mainImg = spec.mainUrl
    ? '<img src="' + esc(spec.mainUrl) + '" loading="lazy" onclick="window.open(this.src)" ' +
      'onerror="this.replaceWith(Object.assign(document.createElement(\\'div\\'),' +
      '{className:\\'missing\\',textContent:\\'⚠ baseline bytes are not in the store\\'}))" />'
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
        (isChanged(spec) ? ' ' + pill('changed', 'changed') : '') +
        (spec.unpublished ? ' ' + pill('unpublished', 'not pushed to the store') : '') +
        runPills(spec) + '</h2>' +
      (spec.run && spec.run.failed ? '<pre class="runerr">' + esc(spec.run.failed) + '</pre>' : '') +
      renderUsages(spec.usages) +
      renderParts(spec) +
      (spec.liveUrl ? '<a class="livelink" href="' + esc(spec.liveUrl) + '" target="_blank" rel="noopener">Open live in JBrowse ↗</a>' : '') +
      // the leading newline is eaten by the HTML parser, so a note that opens
      // with a blank line round-trips without it unless one is spent here
      '<textarea class="note" rows="2" placeholder="note (optional)" onchange="saveNote(this)">\\n' + esc(v ? v.note : '') + '</textarea>' +
      '<div class="actions">' +
        '<button class="approve ' + (status === 'good' ? 'active' : '') + '" onclick="setVerdict(this,\\'good\\')">✓ Approve</button>' +
        '<button class="deny ' + (status === 'bad' ? 'active' : '') + '" onclick="setVerdict(this,\\'bad\\')">✗ Deny</button>' +
        (v ? '<button class="clear" onclick="clearVerdict(this)">clear</button>' : '') +
        (v ? '<span class="reviewedAt">' + new Date(v.reviewedAt).toLocaleString() + '</span>' : '') +
      '</div>' +
      // Below the buttons, not under the box it describes: this line appears
      // the moment you type and disappears the moment the note saves, and the
      // note saves on the blur that the Approve/Deny mousedown itself causes.
      // Above the buttons it moved them 27px out from under the pointer between
      // mousedown and mouseup, so no click was dispatched at all and the first
      // click after typing did nothing.
      '<div class="unsaved">' + esc(draftHint(spec)) + '</div>' +
      '<div class="' + msgClass(spec.name) + '">' + esc(messageText(spec.name)) + '</div>' +
    '</div>' +
  '</div>'
}

function syncControls() {
  for (const b of document.querySelectorAll('header [data-status]')) {
    b.classList.toggle('active', b.dataset.status === filters.status)
  }
  $('[data-toggle="changed"]').classList.toggle('active', filters.changedOnly)
  $('[data-toggle="run"]').classList.toggle('active', filters.runOnly)
  $('#sortby').value = filters.sortBy
  $('#kind').value = filters.kind
  // group belongs here with the other two rather than only in
  // buildGroupOptions: it is the one control whose options are built from the
  // data, so it is the one most likely to be reset out from under the filters
  $('#group').value = filters.group
}

// no parameters: the shared review client calls this after every single-card
// repaint, so it has to be able to see the search box on its own
function renderCounts() {
  const q = $('#search').value.toLowerCase()
  // A tab badge answers "how many cards do I get if I click this", so it counts
  // within the group/kind/search scope and on the tab's own predicate — not over
  // the whole corpus. A global 42 above a filtered view showing 3 reads as a
  // broken filter. The pill row below stays global: that one is the progress
  // reading for the whole sweep.
  const scoped = data.filter(s => matchesScope(s, q))
  const inScope = status =>
    scoped.filter(
      s =>
        hasStatus(s, status) &&
        (!filters.changedOnly || isNew(s) || isChanged(s)) &&
        (!filters.runOnly || hasRunProblem(s)),
    ).length
  for (const status of ['needs', 'good', 'bad', 'answered']) {
    $('[data-count="' + status + '"]').textContent = inScope(status)
  }
  $('[data-count="changed"]').textContent =
    scoped.filter(s => isNew(s) || isChanged(s)).length
  $('[data-count="run"]').textContent = scoped.filter(hasRunProblem).length

  const has = status => s => s.verdict?.status === status && !s.stale
  const answered = data.filter(has('answered')).length
  const good = data.filter(has('good')).length
  const bad = data.filter(has('bad')).length
  const stale = data.filter(s => s.stale).length
  $('#counts').innerHTML =
    pill('good', good + ' approved') +
    pill('bad', bad + ' denied') +
    (answered ? pill('answered', answered + ' answered, awaiting you') : '') +
    (stale ? pill('stale', stale + ' changed since review') : '') +
    pill('none', data.filter(s => !s.verdict).length + ' unreviewed')
}

// everything except the status tab and the changed toggle — the two controls
// whose own badges have to count what switching to them would show
function matchesScope(s, q) {
  const matchesQuery = !q || s.name.toLowerCase().includes(q)
  const matchesGroup = !filters.group || nameGroup(s.name) === filters.group
  const matchesKind =
    filters.kind === 'all' ||
    (filters.kind === 'manual' && !s.autogenerated) ||
    (filters.kind === 'auto' && s.autogenerated)
  return matchesQuery && matchesGroup && matchesKind
}

function hasStatus(s, status) {
  return (
    status === 'all' ||
    (status === 'needs' && needsReview(s)) ||
    (status === 'good' && s.verdict?.status === 'good' && !s.stale) ||
    (status === 'bad' && s.verdict?.status === 'bad' && !s.stale) ||
    (status === 'answered' && s.verdict?.status === 'answered' && !s.stale)
  )
}

function matchesFilters(s, q) {
  const matchesChanged = !filters.changedOnly || isNew(s) || isChanged(s)
  const matchesRun = !filters.runOnly || hasRunProblem(s)
  return matchesScope(s, q) && (justActed.has(s.name) || (hasStatus(s, filters.status) && matchesChanged && matchesRun))
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
    const key = toggleBtn.dataset.toggle === 'run' ? 'runOnly' : 'changedOnly'
    changeFilter(key, !filters[key])
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
