// The content-addressed blob store, shared by every corpus of generated binary
// files this repo keeps out of git.
//
// There are two: the FIGURES the website publishes (`website/scripts/
// figure-store.ts`, which explains at length why the bytes moved to S3) and the
// browser-test GOLDENS (`products/jbrowse-web/browser-tests/snapshot-store.ts`).
// Both hit the same wall for the same reason — an image regenerated on every
// render change is an undeltifiable blob git keeps forever — and both answer it
// the same way: the bytes go to `s3://jbrowse.org/<prefix>/`, git tracks one
// line per file.
//
// What lives HERE is only the part the two must not disagree about:
//
//   THE KEY GRAMMAR. `<name>.<hash12><ext>` is what a store URL looks like, and
//   a URL is a public link — it goes into review comments, issues and chat. Two
//   corpora spelling it two ways is two things a reader has to learn, and any
//   tool that renders a before/after pair would have to know which it was
//   holding.
//
//   THE MANIFEST LINE. `<path> <w>x<h> <bytes> <sha256>`, sorted by path. A
//   person reads both lock files in `git diff`, and a second grammar there is a
//   second thing to parse by eye for no gain.
//
//   THE HASH, which is the integrity check both `pull`s verify against.
//
// What does NOT live here is everything a corpus decides for itself: which
// roots it sweeps, what counts as a member of it, what is derived rather than
// stored, and how a path shortens to a name.
//
// Kept free of `node:fs` and `import.meta` so jest can transform it to CJS —
// the same split, and the same reason, as figure-store.ts vs figure-paths.ts.
import { createHash } from 'node:crypto'

export const storeBucket = 's3://jbrowse.org'

// Everything a corpus has to say about itself for the addressing above to
// resolve. Deliberately three fields: anything a corpus needs that is not one
// of these is not something the store is entitled to an opinion about.
export interface BlobCorpus {
  // The S3 key prefix under the bucket, e.g. `jb2-figures`. One per corpus, so
  // `aws s3 ls` over either is a corpus listing rather than a filtered sweep.
  storePrefix: string
  // Repo-relative path -> the short name a person uses. Corpus-specific because
  // it strips that corpus's own roots: `website/static/img/hic/x.png` -> `hic/x`.
  name: (path: string) => string
  // Matches the extension to carry into the key, so S3 and CloudFront serve a
  // usable content-type and an <img> in a comment just renders.
  extRe: RegExp
}

export interface BlobEntry {
  // Repo-relative, forward slashes.
  path: string
  sha256: string
  bytes: number
  // Absent for formats whose header `imageSize` does not parse (svg, ico).
  width?: number
  height?: number
}

export interface BlobChange {
  path: string
  kind: 'added' | 'changed' | 'removed'
  before?: BlobEntry
  after?: BlobEntry
}

// Code-point order, never `localeCompare`: a manifest is checked in, so two
// machines rewriting it have to agree on the order or the file churns on its
// own.
export function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

// `jb2-figures/hic/overlay_controls.8e3bf6224f3c.png` — the file's own name, a
// short content hash, its extension.
//
// The name is in the key rather than a bare hash for two reasons. A store URL
// is what a reviewer is shown and what a person pastes into an issue, and it
// should say which file it is. And it shrinks the collision domain from global
// to per-file: a truncated hash only has to be unique among revisions of ONE
// image rather than among every blob ever pushed.
//
// Truncation is safe at any length because it is not the integrity check. The
// lock file carries the FULL sha256 and `pull` verifies against that, so a
// collision cannot produce a silently wrong image — `push` would skip the
// upload and `pull` would fail loudly with a hash mismatch, fixable by taking
// more characters. Nothing here is load-bearing on 12.
export function storeKey(
  corpus: BlobCorpus,
  entry: Pick<BlobEntry, 'path' | 'sha256'>,
): string {
  const ext = corpus.extRe.exec(entry.path)?.[0].toLowerCase() ?? ''
  return `${corpus.storePrefix}/${corpus.name(entry.path)}.${entry.sha256.slice(0, 12)}${ext}`
}

export function storeUrl(
  corpus: BlobCorpus,
  entry: Pick<BlobEntry, 'path' | 'sha256'>,
): string {
  return `https://jbrowse.org/${storeKey(corpus, entry)}`
}

// Path first because the file is sorted by it: the eye scans one flush-left
// column, and a `git diff` hunk names the file before it names the hash.
// Single-spaced rather than aligned — padding would rewrite a neighbouring line
// every time a byte count changed a digit.
//
// `header` is the corpus's own, and is expected to carry `#` comment lines
// saying which CLI maintains the file.
export function formatManifest(entries: BlobEntry[], header: string): string {
  const lines = [...entries]
    .sort((a, b) => cmpStr(a.path, b.path))
    .map(
      e =>
        `${e.path} ${e.width && e.height ? `${e.width}x${e.height}` : '-'} ${e.bytes} ${e.sha256}`,
    )
  return `${header}${lines.join('\n')}\n`
}

// `lockName` is only for the error message, so a malformed line names the file
// the reader has to go and fix.
export function parseManifest(
  text: string,
  lockName: string,
): Map<string, BlobEntry> {
  const out = new Map<string, BlobEntry>()
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const [path, dims, bytes, sha256] = line.split(' ')
    if (!path || !dims || !bytes || !sha256) {
      throw new Error(`malformed ${lockName} line: ${raw}`)
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

// Parsed from the header rather than shelled out to `identify` or run through
// sharp, so this module stays dependency-free and usable from any workspace.
//
// Dimensions are in the manifest because a resize is the one change the rest of
// a pipeline is blind to: a pixel diff returns nothing comparable when the two
// images are different sizes. With w/h on the line that shows up in `git diff`
// as `1400x900 -> 1400x1240` instead of as an opaque hash swap.
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

// Fetch one blob and VERIFY it against the manifest's full sha256 before
// handing it back. Shared because the verification is the whole reason a
// truncated key is safe: the key only has to be unique enough to find the
// bytes, and this is what proves they are the right ones. A `pull` that skipped
// it would install a silently wrong image on a collision or a truncated
// response, which is the one failure mode this store must not have.
export async function fetchBlob(
  corpus: BlobCorpus,
  entry: BlobEntry,
): Promise<Buffer> {
  const url = storeUrl(corpus, entry)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`${entry.path}: ${res.status} ${res.statusText} ${url}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const got = hashBuffer(buf)
  if (got !== entry.sha256) {
    throw new Error(
      `${entry.path}: hash mismatch — manifest says ${entry.sha256.slice(0, 12)}, store gave ${got.slice(0, 12)}`,
    )
  }
  return buf
}

// Bounded-concurrency map. The store's operations are all "do this to N files
// over the network", and doing them unbounded opens N sockets.
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

export function diffManifests(
  before: Map<string, BlobEntry>,
  after: Map<string, BlobEntry>,
): BlobChange[] {
  const changes: BlobChange[] = []
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

// The manifest a `push` is about to write: the files it selected as they are on
// disk, plus — when a --filter narrowed the selection — every line the filter
// did not name, carried through from the old manifest untouched.
//
// Pure, and separate from `push`, for one reason: getting it wrong is silent and
// destructive in the same direction every time. A --filter bolted onto a push
// that writes "everything hashed this run" produces a lock holding one line and
// drops every other file from the only record that it exists. Nothing fails — a
// manifest is valid at any size, and the bytes stay in the store — until the
// next `pull` installs nothing.
//
// Unfiltered (no tokens) nothing is carried and the result is exactly the
// worktree, which is what an unscoped push has always written.
export function mergeManifest(
  before: Map<string, BlobEntry>,
  selected: Iterable<BlobEntry>,
  tokens: string[],
  matches: (name: string, tokens: string[]) => boolean,
  nameOf: (path: string) => string,
): Map<string, BlobEntry> {
  const carried = tokens.length
    ? [...before].filter(([path]) => !matches(nameOf(path), tokens))
    : []
  return new Map([...carried, ...[...selected].map(e => [e.path, e] as const)])
}
