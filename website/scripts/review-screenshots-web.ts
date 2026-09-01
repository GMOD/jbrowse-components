import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { parseArgs } from 'node:util'

import {
  createReviewBundle,
  createVerdictRoutes,
  isVerdictStale,
  loadReport as loadReportFile,
  sendJson,
  serveReviewBundle,
} from '@jbrowse/browser-test-utils'

import { CODE_BASE } from '../src/lib/code-base.ts'
import { readManifest, unpublishedFigures } from './figure-paths.ts'
import { figureContentTypes, figureNames, figurePath } from './figure-store.ts'
import {
  collectScreenshots,
  getBaselineState,
  getWorktreeState,
  imageHash,
  imgDir,
  loadReport,
  refreshWorkingTreeScans,
  reportPath,
  scannedImageHash,
  syncJbrowseImgMirror,
  websiteDir,
} from './screenshot-review-lib.ts'
// the record's shape and path only — NOT screenshot-report.ts, which reaches
// screenshot-options.ts and so parses this server's argv as if it were a
// generator run (see the header of screenshot-run-report.ts)
import { type RunReport, runReportPath } from './screenshot-run-report.ts'
import { screenshotLiveUrls, specs } from './screenshot-specs.ts'
import {
  clipStamp,
  collectClips,
  serveClipBytes,
  type Clip,
} from './video-review-lib.ts'

import type { FigureState, SpecEntry, SpecRunState } from './review-payload.ts'

const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    help: { type: 'boolean', short: 'h', default: false },
    port: { type: 'string' },
    'app-port': { type: 'string' },
    // Directories scanned for clips the Videos tab offers. The media corpus by
    // default; a shoot writing somewhere else names it here rather than copying
    // takes into a store directory a bare `figures:push` would then publish.
    clips: { type: 'string', multiple: true },
  },
})

const portVal = values.port ? Number(values.port) : Number.NaN
const port = Number.isFinite(portVal) ? portVal : 3335

// Where a locally running jbrowse-web is. 3000 is what `pnpm start` in
// products/jbrowse-web binds when it is free — and only when it is free; it
// falls back to an arbitrary port otherwise, which is what --app-port is for.
// Serving the same `?config=test_data/…` a hosted live link carries works
// because the dev server's static root is products/jbrowse-web/public, whose
// test_data symlinks to the repo's.
const appPortVal = values['app-port'] ? Number(values['app-port']) : Number.NaN
const appPort = Number.isFinite(appPortVal) ? appPortVal : 3000
const localCodeBase = `http://localhost:${appPort}/`

const clipRoots = (
  values.clips?.length
    ? values.clips
    : [path.resolve(websiteDir, 'static', 'media')]
).map(dir => path.resolve(dir))

// Clips get their own report rather than sharing the figures': the two name
// spaces are unrelated, and a verdict is stamped with a different thing in each.
// Up here because --help prints it, and --help runs before anything below.
const videoReportPath = path.resolve(import.meta.dirname, 'video-review.json')

if (values.help) {
  console.log(`Review website screenshots and video clips in a web UI.

Usage: pnpm review-screenshots-web [--port=3335] [--app-port=3000]
                                  [--clips=<dir>]...

Two tabs. Figures is below; Videos plays every clip found under --clips (the
media corpus by default) with the questions its shoot asked, and takes the same
approve/deny/note verdicts. Name the directory a shoot wrote to rather than
copying takes into the media corpus, which a bare figures:push would publish.

Each figure is shown against the same figure on origin/main, with where the
docs use it, and approve/deny/note controls. Four ways to look at the pair,
set for the whole page — from the Compare control, or from the bar on whichever
card you are looking at:

  side    the two images in two columns
  onion   stacked, with a slider that fades between them (and a blink toggle)
  swipe   stacked, with a divider you drag across the picture
  diff    pixel difference — black wherever the two agree (with an amplifier)

A card's "Open live in JBrowse" opens the session the figure was captured from.
The Live links control chooses which app that is:

  ${CODE_BASE}
  ${localCodeBase} (--app-port names the port)

The local one is \`pnpm start\` in products/jbrowse-web, and is what to use when
the figure is about a change the hosted build does not have yet — otherwise the
link opens a different app from the one the picture came out of.

Verdicts are written to ${path.relative(process.cwd(), reportPath)},
and the clips' to ${path.relative(process.cwd(), videoReportPath)}.
`)
  process.exit(0)
}

// The image route is content-addressed: the URL carries `?v=<hash of the
// bytes>`, so a URL can only ever mean one picture and is safe to cache
// forever. Without this the reviewer's loop — regenerate, RELOAD, look again —
// re-downloaded every image (~70MB) on every single reload, because a bare 200
// with no validators is not cacheable at all.
//
// `verified` is that promise being TRUE of the response, not merely asked for by
// the request — see serveImage. A hash we cannot stand behind means we cannot
// name the bytes, so don't store them.
//
// The baseline side needs nothing here: it is a store URL, already immutable and
// already served with a year of cache by CloudFront.
function cacheHeaders(verified: string | null) {
  return verified
    ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
    : { 'Cache-Control': 'no-store' }
}

function buildSpecPayload(): SpecEntry[] {
  // Every load is a fresh look at the working tree. A review session is
  // regenerate, reload, look again, so the store and doc-usage scans behind
  // `changed`/`mainUrl`/`usages` cannot be answered from what the tree looked
  // like when the server started. Everything below reads through that one scan.
  refreshWorkingTreeScans()
  const report = loadReport()
  const run = loadRunReport()
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
  const runStates = specRunStates(run)
  // Whether the run recorded WHICH specs it reached. `runStates` cannot answer
  // that on its own: it is also seeded from the failure, flake and skip lists,
  // so a report written before `selected` existed (loadRunReport fills it in as
  // empty) has a non-empty map over an empty selection — and every spec not in
  // one of those lists would read as "not in the last run", i.e. the whole
  // corpus. The banner already reports that case as "scope not recorded", and
  // the cards have to agree with it.
  const runKnowsScope = !!run?.selected.length
  // Which figures a sweep could have anything to say about. NOT `autogenerated`,
  // which is also true of the ten desktop figures — those come from a separate
  // Selenium generator (products/jbrowse-desktop/test/screenshots.ts) that
  // writes no run report here, so screenshot-run.json says nothing about them
  // either way and must not be read as saying they were skipped.
  const sweepable = new Set(specs.map(s => s.name))
  return collectScreenshots(specs).map(shot => {
    const verdict = report[shot.name]
    // the hash of the PNG as the reviewer is about to see it. It rides along so
    // the page can say which pixels a verdict was formed against — both to
    // cache-bust the <img> and as the precondition on the write. The stat-keyed
    // form, since this is the scan: the write path re-reads the bytes under the
    // report lock, which is where an unchanged mtime would actually matter.
    const currentHash = scannedImageHash(shot.name)
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
      // undefined when the run had nothing to report about this spec — which,
      // now that the selection is seeded in, means it rendered fine and
      // unchanged rather than "we cannot say"
      run: runStates.get(shot.name),
      // The last run never reached this spec: narrowed past it by --filter,
      // --affected or --cover, or added since. Decided here rather than in the
      // page, because it needs the spec list and the run's own selection, and
      // the page has neither — it was inferring it from whether --filter had
      // been passed, which no --affected or --cover run ever sets.
      notCovered:
        runKnowsScope && sweepable.has(shot.name) && !runStates.has(shot.name),
      imageHash: currentHash ?? null,
      liveUrl,
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
function buildFigureStatePayload(): FigureState {
  const state = getWorktreeState()
  const run = loadRunReport()
  // Deduplicated by `figureNames`, because figureName is not injective: the
  // jb2export figures exist as two files each (the render under
  // products/jbrowse-img/img and the website's byte copy of it), and they move
  // together — so one regen produced "2 figure(s) exist only on this machine"
  // over the same name printed twice. The cards next door stay keyed on the
  // path for the same reason; here the question is genuinely about the figure,
  // so collapsing is the right answer.
  const names = (paths: string[]) => figureNames(paths).sort()
  return {
    unpublished: names(unpublishedFigures(state)),
    unpulled: names(state.missing),
    // "All N figures are published" sits opposite `unpublished.length` in the
    // same banner, so it has to be the same unit. The manifest is keyed by
    // PATH, so its size counted every mirrored figure twice and the two numbers
    // could not be read against each other.
    total: names([...readManifest().keys()]).length,
    // which origin/main the whole "new"/"changed" column is against. Reads off
    // the same memoized baseline /api/specs just used, so it costs a `git log -1`
    // and not a second parse of the manifest.
    baseline: getBaselineState(),
    // Sent once here rather than as a second URL on all 314 cards: a live link
    // is a whole encoded session, and the local one differs from it only in the
    // prefix.
    liveBases: { hosted: CODE_BASE, local: localCodeBase },
    run: run && {
      finishedAt: run.finishedAt,
      filter: run.filter,
      check: run.check,
      failed: run.failures.length,
      flaky: run.flaky.length,
      // How much of the corpus the run reached. `filter` cannot answer that:
      // --affected and --cover narrow just as hard and leave it empty, so a
      // 14-spec run said "a full sweep" and the 300 figures it never opened
      // read as verified by it. Zero for a report written before this was
      // recorded, which the banner reports as unknown rather than as a sweep.
      selected: run.selected.length,
      skipped: run.skipped.length,
      total: run.total,
    },
  }
}

// What the last sweep noticed, keyed by spec name. Re-read per request for the
// same reason the working-tree scans are: the loop is regenerate, reload, look
// again, and a report cached at server start describes the run before the one
// you just did.
//
// Absent is a real answer and is kept distinct from "fine". A spec the last run
// did not touch — because the run was narrowed past it, or predates the spec —
// has no verdict here, and the UI must not draw it as passing.
function loadRunReport(): RunReport | undefined {
  try {
    // A report on disk can predate any given field — `selected`/`total` were
    // added after reports were already being written — so the fields RunReport
    // declares are filled in here rather than guarded at every read.
    const parsed = JSON.parse(
      fs.readFileSync(runReportPath, 'utf8'),
    ) as Partial<RunReport>
    return {
      ...parsed,
      finishedAt: parsed.finishedAt ?? '',
      filter: parsed.filter ?? [],
      check: parsed.check ?? false,
      selected: parsed.selected ?? [],
      total: parsed.total ?? 0,
      skipped: parsed.skipped ?? [],
      failures: parsed.failures ?? [],
      flaky: parsed.flaky ?? [],
      updated: parsed.updated ?? [],
      suppressed: parsed.suppressed ?? [],
    }
  } catch {
    return undefined
  }
}

function specRunStates(run: RunReport | undefined) {
  const byName = new Map<string, SpecRunState>()
  if (!run) {
    return byName
  }
  const touch = (name: string) => {
    let s = byName.get(name)
    if (!s) {
      s = {}
      byName.set(name, s)
    }
    return s
  }
  // Seed with the whole selection, so an entry means "this run reached it" and
  // the lists below only add what went wrong. A spec that rendered fine and
  // unchanged appears in none of them — most of a sweep does — so without this
  // pass "no entry" conflates "nothing to report" with "never opened".
  for (const name of run.selected) {
    touch(name)
  }
  for (const s of run.skipped) {
    touch(s.name).skipped = s.reason
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
  const ext = path.extname(full).toLowerCase()
  const name = full.slice(imgDir.length + 1, full.length - ext.length)
  // a jb2export the reviewer produced a minute ago is only in
  // products/jbrowse-img/img until something copies it across
  syncJbrowseImgMirror(name)
  if (!fs.existsSync(full)) {
    sendNotFound(res)
    return
  }
  // `?v=` may only be believed while it still names the bytes about to go out.
  // The file is read NOW, and a regen between the page load and this request —
  // which is the loop this tool exists for — otherwise caches the NEW picture
  // under the OLD hash's URL, immutably. The reviewer who then reverts that
  // figure is served the wrong pixels out of their own cache, for a year, with
  // nothing on screen saying so. The check is free: this is the memoized,
  // stat-keyed hash the page load already computed.
  //
  // PNG only, because that hash is by name and resolves `<name>.png` — asked
  // about `foo.webp` it would hand back the hash of `foo.png` and bless a URL
  // that names neither. Nothing here emits a `?v=` for anything else.
  const verified = ext === '.png' && v === scannedImageHash(name) ? v : null
  res.writeHead(200, {
    'Content-Type': figureContentTypes[ext] ?? 'application/octet-stream',
    ...cacheHeaders(verified),
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

let clipsByName = new Map<string, Clip>()
const refreshClips = () => {
  clipsByName = new Map(collectClips(clipRoots).map(clip => [clip.name, clip]))
  return clipsByName
}

const videoRoutes = createVerdictRoutes({
  reportPath: videoReportPath,
  hashOf: name => clipStamp(clipsByName.get(name)),
  statuses: ['good', 'bad', 'answered'],
})

function buildVideoPayload() {
  const report = loadReportFile(videoReportPath)
  return [...refreshClips().values()].map(clip => {
    const verdict = report[clip.name]
    const stamp = clipStamp(clip)
    return {
      name: clip.name,
      bytes: clip.bytes,
      modified: clip.modified,
      duration: clip.duration,
      hasPoster: Boolean(clip.poster),
      src: `/clip/${encodeURI(clip.name)}.mp4`,
      ...(clip.poster
        ? { poster: `/clip/${encodeURI(clip.name)}.poster` }
        : {}),
      ...(clip.transcript
        ? { transcript: `/clip/${encodeURI(clip.name)}.transcript` }
        : {}),
      verdict,
      stale: isVerdictStale(verdict, stamp),
      imageHash: stamp ?? null,
    }
  })
}

function serveClip(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
) {
  const rest = decodeURI(pathname.slice('/clip/'.length))
  const dot = rest.lastIndexOf('.')
  const clip = clipsByName.get(rest.slice(0, dot))
  const kind = rest.slice(dot + 1)
  if (!clip) {
    sendNotFound(res)
  } else if (kind === 'mp4') {
    serveClipBytes(req, res, clip.file, 'video/mp4')
  } else if (kind === 'poster' && clip.poster) {
    serveClipBytes(
      req,
      res,
      clip.poster,
      clip.poster.endsWith('.png') ? 'image/png' : 'image/jpeg',
    )
  } else if (kind === 'transcript' && clip.transcript) {
    serveClipBytes(req, res, clip.transcript, 'application/json')
  } else {
    sendNotFound(res)
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

// The page is React, rebuilt by esbuild on every page load — no watcher, no dev
// server, so "run one node script, open localhost" and offline operation both
// survive while an edit to the page still only costs a reload. Its write
// protocol and note-draft bookkeeping are shared with jbrowse-web's browser-test
// snapshot review (@jbrowse/browser-test-utils/reviewApp); this entry supplies
// the two halves that differ, what a card looks like and what the header counts.
//
// Built once before the server listens too, so a syntax error in the page is a
// startup failure with esbuild's own message rather than a blank tab.
const bundle = await createReviewBundle({
  entry: path.resolve(import.meta.dirname, 'review-app', 'main.tsx'),
  title: 'Screenshot review',
  // tells this tab apart from the snapshot review UI, which the two tools are
  // expected to be open beside
  favicon: '🖼️',
})

const server = http.createServer((req, res) => {
  const url = req.url ?? '/'
  const [rawPath, qs] = url.split('?')
  const pathname = rawPath!
  // the image routes are cacheable exactly when the URL names which bytes it
  // wants; `?v=` is that name
  const v = new URLSearchParams(qs ?? '').get('v') || null
  try {
    if (serveReviewBundle(res, pathname, bundle)) {
      // the page, its script and its stylesheet
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
    } else if (pathname === '/api/videos') {
      sendJson(res, 200, buildVideoPayload())
    } else if (pathname === '/api/video-verdict' && req.method === 'POST') {
      videoRoutes.handleVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (
      pathname === '/api/video-verdict/clear' &&
      req.method === 'POST'
    ) {
      videoRoutes.handleClearVerdict(req, res).catch((err: unknown) => {
        sendJson(res, 500, { error: `${err}` })
      })
    } else if (pathname.startsWith('/clip/')) {
      serveClip(req, res, pathname)
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
