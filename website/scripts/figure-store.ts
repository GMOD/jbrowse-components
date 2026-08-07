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
import { createHash } from 'node:crypto'

import { matchesFilterTokens } from './filter-tokens.ts'

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

// Derived-and-gitignored output that happens to live under a figure root.
// gallery-thumbs is regenerated from figures already in the store by
// gen-gallery-thumbs.ts; the other two are transient by construction (see
// website/.gitignore, which is where these rules were already written down).
export function isExcluded(relFromRoot: string): boolean {
  const base = relFromRoot.slice(relFromRoot.lastIndexOf('/') + 1)
  return (
    relFromRoot.startsWith('gallery-thumbs/') ||
    base.startsWith('debug_') ||
    base.endsWith('.tmp')
  )
}

export interface FigureEntry {
  // Repo-relative, forward slashes, e.g. "website/static/img/insertion.png".
  path: string
  sha256: string
  bytes: number
  // Absent for formats whose header this module does not parse (svg, ico) — see
  // imageSize. Present for every png and webp, which is 450 of the 452 figures.
  width?: number
  height?: number
}

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

// Code-point order, never `localeCompare`: the manifest is checked in, so two
// machines rewriting it have to agree on the order or the file churns on its
// own. Same reasoning as `cmpStr` in packages/core, duplicated because this
// script imports nothing from the workspace.
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// Path first because the file is sorted by it: the eye scans one flush-left
// column, and a `git diff` hunk names the figure before it names the hash.
// Single-spaced rather than aligned — padding would rewrite a neighbouring
// line every time a byte count changed a digit.
export function formatManifest(entries: FigureEntry[]): string {
  const lines = [...entries]
    .sort((a, b) => cmpStr(a.path, b.path))
    .map(
      e =>
        `${e.path} ${e.width && e.height ? `${e.width}x${e.height}` : '-'} ${e.bytes} ${e.sha256}`,
    )
  return `${MANIFEST_HEADER}${lines.join('\n')}\n`
}

export function parseManifest(text: string): Map<string, FigureEntry> {
  const out = new Map<string, FigureEntry>()
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const [path, dims, bytes, sha256] = line.split(' ')
    if (!path || !dims || !bytes || !sha256) {
      throw new Error(`malformed figures.lock line: ${raw}`)
    }
    const [w, h] = dims === '-' ? [] : dims.split('x').map(Number)
    out.set(path, {
      path,
      sha256,
      bytes: Number(bytes),
      ...(w && h ? { width: w, height: h } : {}),
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// store addressing
// ---------------------------------------------------------------------------

export const storeBucket = 's3://jbrowse.org'
export const storePrefix = 'jb2-figures'

// `jb2-figures/hic/overlay_controls.8e3bf6224f3c.png` — the figure's own name,
// a short content hash, its extension.
//
// The name is in the key, not just a bare hash, for two reasons. A store URL is
// what `report` puts in front of a reviewer and what a person pastes into an
// issue, and it should say which figure it is. And it shrinks the collision
// domain from global to per-figure: a truncated hash only has to be unique
// among revisions of ONE figure — on current churn about 22 a year — rather
// than among every blob ever pushed. Twelve hex characters is 48 bits against
// a few hundred revisions, which is not a real number.
//
// Truncation is safe at any length, because it is not the integrity check.
// figures.lock carries the FULL sha256 and `pull` verifies against that, so a
// collision cannot produce a silently wrong image — `push` would skip the
// upload and `pull` would fail loudly with a hash mismatch, fixable by taking
// more characters. Nothing here is load-bearing on 12.
//
// No hash-prefix fan-out directory: S3 has partitioned automatically since
// 2018, and the figure's own directory is a better shape for `aws s3 ls` than
// two hex characters.
//
// The extension is kept so S3 and CloudFront serve a usable content-type and an
// <img> in a PR comment or a step summary just renders.
export function storeKey(entry: Pick<FigureEntry, 'path' | 'sha256'>): string {
  const ext = figureExtRe.exec(entry.path)?.[0].toLowerCase() ?? ''
  return `${storePrefix}/${figureName(entry.path)}.${entry.sha256.slice(0, 12)}${ext}`
}

export function storeUrl(entry: Pick<FigureEntry, 'path' | 'sha256'>): string {
  return `https://jbrowse.org/${storeKey(entry)}`
}

export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

// ---------------------------------------------------------------------------
// dimensions
// ---------------------------------------------------------------------------

// Parsed from the header rather than shelled out to `identify` or run through
// sharp, so this module stays dependency-free and usable from any workspace.
//
// Dimensions are in the manifest because a resize is the one figure change the
// rest of the pipeline is blind to: pngDiffFraction returns null when the two
// images are different sizes, and website/CLAUDE.md already has a whole bullet
// on `viewportHeight` aging into dead grey under the content. With w/h on the
// line, that shows up in `git diff` as `1400x900 -> 1400x1240` instead of as an
// opaque hash swap.
export function imageSize(buf: Buffer): { width?: number; height?: number } {
  // PNG: 8-byte signature, then the IHDR chunk's length+type, then w/h as u32be.
  if (buf.length >= 24 && buf.subarray(12, 16).toString('latin1') === 'IHDR') {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  // GIF: logical screen descriptor, u16le, right after the 6-byte signature.
  if (buf.length >= 10 && buf.subarray(0, 3).toString('latin1') === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
  }
  if (
    buf.length >= 30 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return webpSize(buf)
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    return jpegSize(buf)
  }
  return {}
}

// WebP has three container flavours and the thumbs under static/img are written
// by sharp, which picks between them per image — so all three have to be here
// or a chunk of the .webp figures would silently lose their dimensions.
function webpSize(buf: Buffer): { width?: number; height?: number } {
  const fourcc = buf.subarray(12, 16).toString('latin1')
  if (fourcc === 'VP8X') {
    // Extended: 24-bit little-endian canvas width-1 / height-1 at byte 24.
    return {
      width: buf.readUIntLE(24, 3) + 1,
      height: buf.readUIntLE(27, 3) + 1,
    }
  }
  if (fourcc === 'VP8 ') {
    // Lossy: the VP8 keyframe header's 14-bit dimensions, after the 3-byte
    // frame tag and the 3-byte start code.
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    }
  }
  if (fourcc === 'VP8L' && buf[20] === 0x2f) {
    // Lossless: 14 bits of width-1 then 14 bits of height-1, packed LE across
    // the four bytes after the 0x2f signature byte.
    const bits = buf.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    }
  }
  return {}
}

function jpegSize(buf: Buffer): { width?: number; height?: number } {
  let i = 2
  // <=, not <: a SOF that ends exactly at the last byte is still a SOF, and
  // readUInt16BE(i + 7) reads through i + 8.
  while (i + 9 <= buf.length) {
    if (buf[i] !== 0xff) {
      return {}
    }
    const marker = buf[i + 1]!
    // SOF0-SOF15 minus the three in that range that are not start-of-frame
    // (DHT, JPG, DAC) — every real SOF carries h then w at the same offset.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
    }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return {}
}

// ---------------------------------------------------------------------------
// diffing
// ---------------------------------------------------------------------------

export interface FigureChange {
  path: string
  kind: 'added' | 'changed' | 'removed'
  before?: FigureEntry
  after?: FigureEntry
}

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
  const carried = tokens.length
    ? [...before].filter(
        ([path]) => !matchesFilterTokens(figureName(path), tokens, exact),
      )
    : []
  return new Map([...carried, ...[...selected].map(e => [e.path, e] as const)])
}

export function diffManifests(
  before: Map<string, FigureEntry>,
  after: Map<string, FigureEntry>,
): FigureChange[] {
  const changes: FigureChange[] = []
  for (const [path, entry] of after) {
    const prev = before.get(path)
    if (!prev) {
      changes.push({ path, kind: 'added', after: entry })
    } else if (prev.sha256 !== entry.sha256) {
      changes.push({ path, kind: 'changed', before: prev, after: entry })
    }
  }
  for (const [path, entry] of before) {
    if (!after.has(path)) {
      changes.push({ path, kind: 'removed', before: entry })
    }
  }
  return changes.sort((a, b) => cmpStr(a.path, b.path))
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
}

export function compareToBaseline(
  path: string,
  disk: Map<string, FigureEntry>,
  base: Map<string, FigureEntry>,
  missing: ReadonlySet<string>,
): FigureComparison {
  const here = disk.get(path)
  const there = base.get(path)
  return {
    exists: here !== undefined,
    unpulled: here === undefined && missing.has(path),
    ...(there ? { mainUrl: storeUrl(there) } : {}),
    changed:
      here !== undefined && there !== undefined && here.sha256 !== there.sha256,
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
