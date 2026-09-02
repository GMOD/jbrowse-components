// The figure store: figure BYTES live in S3, and git tracks only `figures.lock`.
//
// Why. static/img is 424 files and 62 MB, and the sweep that keeps it honest
// rewrites whatever the app moved — 4,918 figure revisions in the last six
// months. Every one of those is an undeltifiable binary blob that git keeps
// forever: 4,754 unique figure blobs, 0.67 GiB of a 1.64 GiB pack, growing
// ~1.4 GiB/yr. Nobody ever reads the old ones, but everybody clones them.
//
// So the bytes move under `s3://jbrowse.org/jb2-figures/` and git tracks one
// line per figure instead. See storeKey below for the shape of a key. Three
// properties make that safe:
//
//   CONTENT-ADDRESSED, so a key is never overwritten. The bucket's versioning
//   is Suspended — it ran versioned 2021-2025, so old objects still have real
//   version ids, but everything written since gets version id `null` and a PUT
//   clobbers it in place. That is the deploy-demo.sh warning in CLAUDE.md, and
//   it is a loaded gun for anything written by path. It cannot go off here,
//   because the only write is "create a key named after bytes that hash to it":
//   re-pushing identical content is a no-op, and different content is a
//   different key. Turning versioning back on would add nothing for figures —
//   there is no overwrite to protect against — only deletion cover.
//
//   IMMUTABLE, so every revision ever pushed stays fetchable at its own URL.
//   That is what makes review work: `figures report` renders BEFORE and AFTER
//   side by side by pointing at two store URLs, which is strictly more than
//   GitHub's built-in image diff could do, and it keeps working for a manifest
//   line from any commit.
//
//   NOTHING IS EVER DELETED FROM THE STORE, including keys no manifest points
//   at any more. A store URL is a public link: it goes into review comments,
//   issues, chat, and papers, and it should not rot because a figure was later
//   regenerated. Orphans are the cost of that and it is a rounding error — the
//   entire working set is 62 MB, about $0.0015/month. There is deliberately no
//   `gc` command; if you find yourself writing one, this is the note saying no.
//
//   PUBLIC, so `pull` is a plain HTTPS GET through CloudFront and needs no AWS
//   credentials. Only `push` does. A contributor, a fork's CI, and a cold
//   `pnpm build` all fetch figures the same way a reader loads the site.
//
// What this does NOT do: shrink the existing pack. Those 0.67 GiB stay
// reachable from history and only a rewrite would remove them, which would
// break every fork and clone. This caps the growth, it does not undo it.
//
// Kept free of `node:fs` and `import.meta` so jest can transform it to CJS —
// the same split, for the same reason, as check-utils.ts vs paths.ts. The
// filesystem half is figure-paths.ts.
//
// The addressing, the manifest grammar and the hash are NOT here: they are
// `@jbrowse/browser-test-utils/blobStore`, shared with the browser-test golden
// store, which hit the same wall for the same reason. This file is what is
// figure-SPECIFIC — which roots are swept, what is derived rather than stored,
// how a path shortens to a name — plus the reports nothing else wants.
import {
  diffManifests as diffBlobManifests,
  formatManifest as formatBlobManifest,
  mergeManifest as mergeBlobManifest,
  parseManifest as parseBlobManifest,
  storeKey as blobStoreKey,
  storeUrl as blobStoreUrl,
} from '@jbrowse/browser-test-utils/blobStore'

import { matchesFilterTokens } from './filter-tokens.ts'

import type {
  BlobChange,
  BlobCorpus,
  BlobEntry,
} from '@jbrowse/browser-test-utils/blobStore'

export {
  hashBuffer,
  imageSize,
  storeBucket,
} from '@jbrowse/browser-test-utils/blobStore'

// Repo-relative, and the only definition of "is this a figure". Both are swept
// together by generate-screenshots.ts, so they share a store.
export const figureRoots = [
  'website/static/img',
  'products/jbrowse-img/img',
] as const

export const figureExtRe = /\.(png|webp|jpe?g|gif|svg|ico)$/i

// What a figure is served as, by extension, for both things that serve one: the
// `push` upload (explicit rather than left to the aws CLI's mimetypes guess,
// which differs by platform and has historically not known about webp) and the
// review server's /img route. One table, because a figure type this does not
// know about is served as a download by one of them and as octet-stream by the
// other, and finding out costs a round trip through S3 either way.
export const figureContentTypes: Record<string, string> = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

// A figure COMPUTED from other figures — a card crop, a homepage thumb, a webp
// twin — and therefore not something the store holds. Each is a pure function of
// a figure the store does have plus a spec in git, so the bytes carry no
// information the repo lacks, and the generators below run from `dev`, `build`
// and `index`.
//
// Storing them instead is what this replaced, and it failed the same way every
// time: a figure republished WITHOUT its derivatives — a review pass, a weekly
// sweep, anything calling `figures push` — left the stored crop describing the
// old picture, `autogen --check` reddened main a push later, and the fix was
// always the mechanical regenerate-and-push. Three separate pushes on
// 2026-08-13 alone. Nothing derived can go stale against its source if no copy
// of it is kept, which is the argument gen-gallery-thumbs.ts had already made
// for its own output and is now the rule for all of them.
//
// The prefixes are directories the generators own outright. The two loose names
// are gen-home-images.ts's, whose output sits beside its sources because the
// homepage and the blog have linked `/img/screenshot.webp` for years; that
// generator asserts every path it writes is named here, so a new one cannot
// quietly become a stored figure.
const derivedFigureDirs = [
  'gallery-thumbs/',
  'tutorial-thumbs/',
  'home-gallery/',
  // drawn from committed reads by gen-segment-maps.ts, no capture involved
  'segment-maps/',
]
const derivedFigureFiles = new Set([
  'screenshot.webp',
  'desktop-available-genomes.webp',
])

// Scoped to the website root rather than matched anywhere: products/jbrowse-img
// is a second corpus of hand-captured figures that happens to share this
// namespace, and a `screenshot.webp` appearing there is a figure to store, not
// a crop to recompute.
export function isDerivedFigure(relFromRoot: string, root: string): boolean {
  return (
    root === 'website/static/img' &&
    (derivedFigureDirs.some(d => relFromRoot.startsWith(d)) ||
      derivedFigureFiles.has(relFromRoot))
  )
}

// What lives under a figure root without being a figure: the derived output
// above, and files transient by construction (see website/.gitignore, which is
// where the latter rules were already written down).
export function isExcluded(relFromRoot: string, root: string): boolean {
  const base = relFromRoot.slice(relFromRoot.lastIndexOf('/') + 1)
  return (
    isDerivedFigure(relFromRoot, root) ||
    base.startsWith('debug_') ||
    base.endsWith('.tmp')
  )
}

// One figure's manifest line. The shape is the store's (`BlobEntry`); the alias
// is kept because "figure" is what every caller here is holding and renaming
// 200 call sites would say nothing.
export type FigureEntry = BlobEntry

// ---------------------------------------------------------------------------
// manifest
// ---------------------------------------------------------------------------

const MANIFEST_HEADER = `\
# Figure store manifest — the bytes live in S3, this file is what git tracks.
#
# One line per figure, sorted by path, so a commit that changes three figures
# changes three lines. Run \`pnpm figures\` for the CLI; \`pnpm figures:report\`
# renders what moved, with before/after images, against any base ref.
#
# <path> <width>x<height> <bytes> <sha256>
`

export function formatManifest(entries: FigureEntry[]): string {
  return formatBlobManifest(entries, MANIFEST_HEADER)
}

export function parseManifest(text: string): Map<string, FigureEntry> {
  return parseBlobManifest(text, 'figures.lock')
}

// ---------------------------------------------------------------------------
// store addressing
// ---------------------------------------------------------------------------

export const storePrefix = 'jb2-figures'

// The figure corpus, as the shared store sees it. No hash-prefix fan-out
// directory: S3 has partitioned automatically since 2018, and the figure's own
// directory is a better shape for `aws s3 ls` than two hex characters.
export const figureCorpus: BlobCorpus = {
  storePrefix,
  name: path => figureName(path),
  extRe: figureExtRe,
}

export function storeKey(entry: Pick<FigureEntry, 'path' | 'sha256'>): string {
  return blobStoreKey(figureCorpus, entry)
}

export function storeUrl(entry: Pick<FigureEntry, 'path' | 'sha256'>): string {
  return blobStoreUrl(figureCorpus, entry)
}

// ---------------------------------------------------------------------------
// diffing
// ---------------------------------------------------------------------------

export type FigureChange = BlobChange

// What "now" is, per figure: its BYTES if they are on disk, its figures.lock
// line if they are not. `report` diffs a base ref against this.
//
// Both halves are load-bearing, and getting either wrong is silent. Without the
// bytes, the state you are usually in when you want to look at a figure —
// regenerated and not yet pushed — reports as nothing at all, because the lock
// only moves on `push`. Without the lock line, push.yml reports every figure as
// removed on every push: it runs `report` on a plain checkout with no sweep and
// no `figures:pull`, and figure bytes are gitignored, so nothing is on disk
// there. A partial checkout gets the sensible thing per file.
export function resolveNow(
  manifest: Map<string, FigureEntry>,
  onDisk: Iterable<FigureEntry>,
): Map<string, FigureEntry> {
  const now = new Map(manifest)
  for (const entry of onDisk) {
    now.set(entry.path, entry)
  }
  return now
}

// The manifest `push` is about to write: the figures it selected as they are on
// disk, plus — when a --filter narrowed the selection — every line the filter did
// not name, carried through from the old manifest untouched.
//
// Pure, and separated from `push` for one reason: getting it wrong is silent and
// destructive in the same direction every time. `push` already had the shape
// where the manifest is written from "everything hashed this run", so a --filter
// bolted on without this would have written a figures.lock holding one line and
// deleted 484 figures from the site's only record that they exist. Nothing would
// have failed — a manifest is valid at any size, and the bytes stay in the store
// — until the next `pull` installed nothing and the build shipped without them.
//
// Unfiltered (no tokens) nothing is carried and the result is exactly the
// worktree, which is what push has always written.
export function mergeManifest(
  before: Map<string, FigureEntry>,
  selected: Iterable<FigureEntry>,
  tokens: string[],
  exact = false,
): Map<string, FigureEntry> {
  return mergeBlobManifest(
    before,
    selected,
    tokens,
    (name, toks) => matchesFilterTokens(name, toks, exact),
    figureName,
  )
}

export function diffManifests(
  before: Map<string, FigureEntry>,
  after: Map<string, FigureEntry>,
): FigureChange[] {
  return diffBlobManifests(before, after)
}

// "insertion", "hic/overlay_controls" — how a doc's <Figure src> names it, and
// how a reviewer talks about it.
//
// NOT injective, and the review tooling is the caller that gets bitten: 27 names
// come from two paths each, because jb2export renders to
// products/jbrowse-img/img and the website keeps a mirror of every one of them.
// Anything keyed on the name conflates the pair — use figurePath below wherever
// the question is about one specific file.
export function figureName(path: string): string {
  return path
    .replace(/^website\/static\/img\//, '')
    .replace(/^products\/jbrowse-img\/img\//, 'jbrowse-img/')
    .replace(figureExtRe, '')
}

// The names a list of paths is ABOUT, in the order they first appear. What the
// reports print and count: a header saying "N modified" and N lines under it
// are both read as figures, and mapping paths one for one made each mirrored
// pair its own row and its own unit — a report that says 401 where a reader
// counting the lines gets 372, and repeats two names verbatim on the way there.
// That reads as the scan having gone wrong rather than as one figure kept in
// two places. Anything ranging over paths to say something about figures wants
// this; anything acting on the files themselves wants the paths.
export function figureNames(paths: string[]): string[] {
  return [...new Set(paths.map(figureName))]
}

// The manifest key for the figure a review card is about: the exact file the
// review server serves at /img/<name>.png. This is the join between a card and
// the store, so it has to produce a key the manifest actually has — a lookup
// that matches nothing reads as "no such figure", which is indistinguishable
// from "unchanged" and is how the review baseline stayed dead for months.
//
// `.png` is not a simplification. Every source a card can come from produces
// PNG: a generate-screenshots spec, the desktop capture list, and the doc
// scanner, whose regex only matches `/img/<name>.png`. The other 51 figures
// under this root (.webp, .jpg, .ico, .svg) are home-gallery art and derived
// copies that never become cards. If a spec ever emits something else, this is
// the line that has to learn about it.
export function figurePath(name: string): string {
  return `website/static/img/${name}.png`
}

// What a card says about one figure relative to the baseline. Pure over the two
// manifests so it can be tested without git or a worktree: `disk` is the figures
// on this machine, `base` is figures.lock at the review ref, `missing` is the
// paths the manifest names that this checkout has not pulled.
//
// The four states are deliberately distinct. "not in base" is a new figure;
// "in base, different sha" is an update; "not on disk but in the manifest" is an
// unfinished pull, whose fix is `figures:pull` and NOT a regen; "not on disk and
// not in the manifest" is the only one that means regenerate.
export interface FigureComparison {
  exists: boolean
  unpulled: boolean
  mainUrl?: string
  changed: boolean
  // Natural size of each side, so the review page can reserve an image's box
  // before its bytes land. Both manifests already carry it, so this is free —
  // and without it a card is 180px tall until its picture decodes and up to
  // 400px after, which moves every card below it while you are scrolling.
  // Absent for a side that has no figure, and for one whose entry predates the
  // manifest carrying dimensions.
  size?: [number, number]
  mainSize?: [number, number]
}

const naturalSize = (e: FigureEntry | undefined) =>
  e?.width && e.height ? ([e.width, e.height] as [number, number]) : undefined

export function compareToBaseline(
  path: string,
  disk: Map<string, FigureEntry>,
  base: Map<string, FigureEntry>,
  missing: ReadonlySet<string>,
): FigureComparison {
  const here = disk.get(path)
  const there = base.get(path)
  const size = naturalSize(here)
  const mainSize = naturalSize(there)
  return {
    exists: here !== undefined,
    unpulled: here === undefined && missing.has(path),
    ...(there ? { mainUrl: storeUrl(there) } : {}),
    changed:
      here !== undefined && there !== undefined && here.sha256 !== there.sha256,
    ...(size ? { size } : {}),
    ...(mainSize ? { mainSize } : {}),
  }
}

function dims(e: FigureEntry | undefined): string {
  return e?.width && e.height ? `${e.width}×${e.height}` : '?'
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} kB`
}

function sizeNote(c: FigureChange): string {
  if (c.kind !== 'changed') {
    return kb((c.after ?? c.before)!.bytes)
  }
  const b = c.before!
  const a = c.after!
  const resized = dims(b) !== dims(a)
  const delta = a.bytes - b.bytes
  const pct = b.bytes ? Math.round((delta / b.bytes) * 100) : 0
  return [
    resized ? `**resized** ${dims(b)} → ${dims(a)}` : dims(a),
    `${kb(b.bytes)} → ${kb(a.bytes)} (${delta >= 0 ? '+' : ''}${pct}%)`,
  ].join('<br>')
}

// GitHub renders raw <img> in markdown, in both a PR comment and a step
// summary, and every store URL is immutable and public — so the BEFORE column
// keeps rendering forever, from any commit's manifest. That is the whole reason
// the store is content-addressed rather than a mirror of the tree.
// `unpublished`, where given, is the set of figure paths whose bytes are on this
// machine and not in the store. Their `after` URL is well-formed (the store key
// is the hash) and 404s, so both formatters name them instead of linking a blob
// that is not there. `push` passes nothing: everything it reports is about to be
// uploaded.
interface ReportOpts {
  base: string
  unpublished?: Set<string>
}

export function formatMarkdownReport(
  changes: FigureChange[],
  { base, unpublished }: ReportOpts,
): string {
  if (!changes.length) {
    return `No figures changed against \`${base}\`.\n`
  }
  const counts = (['changed', 'added', 'removed'] as const)
    .map(k => [k, changes.filter(c => c.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ')
  // Only the `after` can be missing from the store. `unpublished` is keyed by
  // path, and both sides of a change share one, so testing it on the `before`
  // too would label the base ref's blob — which is in the store by construction,
  // or the base could not have been pushed.
  const img = (e: FigureEntry | undefined, isAfter = false) =>
    e
      ? isAfter && unpublished?.has(e.path)
        ? '_not pushed yet_'
        : `<img src="${storeUrl(e)}" width="380">`
      : '—'
  return [
    `### ${changes.length} figure(s) moved against \`${base}\` — ${counts}`,
    '',
    '| figure | before | after | |',
    '| --- | --- | --- | --- |',
    ...changes.map(
      c =>
        `| **${figureName(c.path)}**<br>${c.kind} | ${img(c.before)} | ${img(c.after, true)} | ${sizeNote(c)} |`,
    ),
    '',
  ].join('\n')
}

export function formatTextReport(
  changes: FigureChange[],
  { base, unpublished }: ReportOpts,
): string {
  if (!changes.length) {
    return `No figures changed against ${base}.`
  }
  const mark = { added: '+', changed: '~', removed: '-' }
  const after = (e: FigureEntry) =>
    unpublished?.has(e.path)
      ? '      after   not pushed yet — `pnpm figures:push` to give it a URL'
      : `      after  ${storeUrl(e)}`
  return [
    `${changes.length} figure(s) moved against ${base}:`,
    '',
    ...changes.map(c =>
      [
        `  ${mark[c.kind]} ${figureName(c.path)}`,
        `      ${sizeNote(c).replaceAll('<br>', '  ').replaceAll('**', '')}`,
        c.before ? `      before ${storeUrl(c.before)}` : '',
        c.after ? after(c.after) : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n')
}
