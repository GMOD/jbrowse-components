// The figure store: figure BYTES live in S3, and git tracks only `figures.lock`.
//
// Why. static/img is 424 files and 62 MB, and the sweep that keeps it honest
// rewrites whatever the app moved — 4,918 figure revisions in the last six
// months. Every one of those is an undeltifiable binary blob that git keeps
// forever: 4,754 unique figure blobs, 0.67 GiB of a 1.64 GiB pack, growing
// ~1.4 GiB/yr. Nobody ever reads the old ones, but everybody clones them.
//
// So the bytes move to `s3://jbrowse.org/jb2-figures/<ab>/<sha256>.<ext>` and
// git tracks one line per figure instead. Three properties make that safe:
//
//   CONTENT-ADDRESSED, so a key is never overwritten. The bucket has no
//   versioning (see the deploy-demo.sh warning in CLAUDE.md) and that is
//   normally a loaded gun — here it cannot go off, because the only write is
//   "create a key named after bytes that hash to it". Re-pushing identical
//   content is a no-op; pushing different content writes a different key.
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

// Repo-relative, and the only definition of "is this a figure". Both are swept
// together by generate-screenshots.ts, so they share a store.
export const figureRoots = [
  'website/static/img',
  'products/jbrowse-img/img',
] as const

export const figureExtRe = /\.(png|webp|jpe?g|gif|svg|ico)$/i

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

// Path first because the file is sorted by it: the eye scans one flush-left
// column, and a `git diff` hunk names the figure before it names the hash.
// Single-spaced rather than aligned — padding would rewrite a neighbouring
// line every time a byte count changed a digit.
export function formatManifest(entries: FigureEntry[]): string {
  const lines = [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
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
  return changes.sort((a, b) => (a.path < b.path ? -1 : 1))
}

// "insertion", "hic/overlay_controls" — how a doc's <Figure src> names it, and
// how a reviewer talks about it.
export function figureName(path: string): string {
  return path
    .replace(/^website\/static\/img\//, '')
    .replace(/^products\/jbrowse-img\/img\//, 'jbrowse-img/')
    .replace(figureExtRe, '')
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
export function formatMarkdownReport(
  changes: FigureChange[],
  { base }: { base: string },
): string {
  if (!changes.length) {
    return `No figures changed against \`${base}\`.\n`
  }
  const counts = (['changed', 'added', 'removed'] as const)
    .map(k => [k, changes.filter(c => c.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(', ')
  const img = (e: FigureEntry | undefined) =>
    e ? `<img src="${storeUrl(e)}" width="380">` : '—'
  return [
    `### ${changes.length} figure(s) moved against \`${base}\` — ${counts}`,
    '',
    '| figure | before | after | |',
    '| --- | --- | --- | --- |',
    ...changes.map(
      c =>
        `| **${figureName(c.path)}**<br>${c.kind} | ${img(c.before)} | ${img(c.after)} | ${sizeNote(c)} |`,
    ),
    '',
  ].join('\n')
}

export function formatTextReport(
  changes: FigureChange[],
  { base }: { base: string },
): string {
  if (!changes.length) {
    return `No figures changed against ${base}.`
  }
  const mark = { added: '+', changed: '~', removed: '-' }
  return [
    `${changes.length} figure(s) moved against ${base}:`,
    '',
    ...changes.map(c =>
      [
        `  ${mark[c.kind]} ${figureName(c.path)}`,
        `      ${sizeNote(c).replaceAll('<br>', '  ').replaceAll('**', '')}`,
        c.before ? `      before ${storeUrl(c.before)}` : '',
        c.after ? `      after  ${storeUrl(c.after)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n')
}
