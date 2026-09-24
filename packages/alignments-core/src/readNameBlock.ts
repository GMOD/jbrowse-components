import type { Feature } from '@jbrowse/core/util'

/**
 * Every read's QNAME as ONE string plus a `Uint32Array` of offsets into it,
 * and the accessor that slices a name back out.
 *
 * A QNAME has no numeric form, so this is not `readIdentity`'s trick with a
 * different name on it. What it shares is the reason: the result used to carry
 * `readNames: string[]`, and structured clone is priced by object COUNT, so
 * 153,677 names were 153,677 objects to clone. What is different — and is
 * actually the larger half — is that a name is DECODED rather than copied:
 * `@gmod/bam` builds the string from the record's bytes on every read of
 * `.name`, deliberately unmemoized (its own comment says why), so the worker was
 * paying a per-read `String.fromCharCode` for an array almost nothing reads.
 *
 * On the 153,677-read window that measured 34.7ms to decode and 7.5ms to clone.
 * Copying the raw bytes once and handing them to ONE `TextDecoder` call is
 * 22.0ms, and the block then clones in 2.8ms: 42.2ms -> 24.7ms, 1.7x
 * (`benches/readNames.bench.ts`, whose PROD arm runs this function).
 *
 * WHY A STRING AND NOT THE BYTES. Raw bytes ship faster still (19.7ms) and are
 * worse to use: V8 slices a string in O(1) — `slice` on a long string is a
 * SlicedString, no copy — so a hover reads a name for nothing and a bulk
 * consumer reads all of them for 4.4ms, where decoding them back out of bytes is
 * 27.8ms. The shape that is cheapest to send is not the one that is cheapest to
 * have sent.
 *
 * WHAT IT COSTS THE BULK CONSUMERS. `groupReadsByName` (arcs and the linked-read
 * overlay) keys a Map by the name, and hashing a SlicedString flattens it — so
 * grouping out of the block is 31.9ms against 16.1ms out of a `string[]`.
 * Netted against the worker's own saving that leaves arcs/chain mode a small win
 * (56.6ms against 58.3ms) and plain pileup — the default, and the deep-coverage
 * case — 1.7x. Don't "fix" the grouping by materialising the array again; that
 * trades the win for the wash.
 *
 * The regime is read COUNT: 200x.shortread (31k reads) is 8.2ms all in, and
 * 200x.longread (335 reads, 6.8-byte names) is 0.08ms, where the block loses.
 */
export interface ReadNames {
  readNameBlock: string
  // n + 1 entries: name `i` is `[offsets[i], offsets[i + 1])`. The extra entry
  // is what lets a name's length be read without a parallel array.
  readNameOffsets: Uint32Array
}

/**
 * Read `i`'s QNAME. `''` for a read that has none — which is not only a
 * malformed SAM record: the PAF/synteny blocks LGVSyntenyDisplay pushes through
 * this pipeline carry no QNAME at all, and `groupReadsByName` skips them for
 * that reason.
 */
export function readNameAt(d: ReadNames, i: number) {
  const start = d.readNameOffsets[i]
  const end = d.readNameOffsets[i + 1]
  return start === undefined || end === undefined
    ? ''
    : d.readNameBlock.slice(start, end)
}

// `latin1`, not `utf-8`, and that is a compatibility decision rather than a
// performance one: `@gmod/bam`'s own `name` getter is
// `String.fromCharCode(...bytes)`, which maps each byte to the code point of the
// same value — exactly latin1. The SAM spec restricts QNAME to printable ASCII
// so the two agree on every valid record, but decoding as utf-8 would silently
// differ on a malformed one, and this is a refactor.
const latin1 = new TextDecoder('latin1')

/**
 * A feature that can write its QNAME bytes out without building the string.
 * `BamSlightlyLazyFeature` implements it, and the two members are a PAIR — the
 * length sizes the buffer, the copy fills it.
 *
 * ALLOCATION-FREE, which is the whole point and is easy to lose. The obvious
 * shape is a `nameBytes` view, and a `subarray` per read gave the entire win
 * back: 35.9ms against 21.1ms, no better than decoding every name. Anything
 * implementing this must allocate nothing per read.
 */
interface NameBytesSource {
  nameLength?: number
  copyNameInto?: (dest: Uint8Array, at: number) => void
}

/**
 * The block for names already in hand. The path a source with no raw bytes
 * takes, and the one a test fixture builds with — `readNameOffsets` has to be
 * n + 1 entries and cumulative, which is exactly the invariant a hand-written
 * fixture gets wrong.
 */
export function namesToBlock(names: string[]): ReadNames {
  const n = names.length
  const readNameOffsets = new Uint32Array(n + 1)
  let total = 0
  for (let i = 0; i < n; i++) {
    total += names[i]!.length
    readNameOffsets[i + 1] = total
  }
  return { readNameBlock: names.join(''), readNameOffsets }
}

/**
 * Build the block for one fetch's features.
 *
 * Two paths, because only BAM has raw bytes to hand: a source that already holds
 * decoded strings (CRAM, SAM, and the synteny blocks) simply joins them, which
 * costs 6.5ms where it saves 5.2ms of clone — a wash, taken so there is one
 * shape downstream rather than two. BAM is where the 1.8x lives, because there
 * the decode never happens at all.
 */
export function buildReadNameBlock(features: Feature[]): ReadNames {
  const n = features.length
  // One cast for the array rather than one per element — the per-element form
  // is the same assertion n times in a hot loop.
  const named = features as (Feature & NameBytesSource)[]
  if (named[0]?.copyNameInto === undefined) {
    return namesToBlock(features.map(f => f.get('name') ?? ''))
  }

  // Two passes: the lengths size the buffer, then each read writes itself into
  // it. Nothing is allocated per read in either.
  const readNameOffsets = new Uint32Array(n + 1)
  let total = 0
  for (let i = 0; i < n; i++) {
    total += named[i]!.nameLength ?? 0
    readNameOffsets[i + 1] = total
  }
  const buf = new Uint8Array(total)
  for (let i = 0; i < n; i++) {
    named[i]!.copyNameInto?.(buf, readNameOffsets[i]!)
  }
  return { readNameBlock: latin1.decode(buf), readNameOffsets }
}
