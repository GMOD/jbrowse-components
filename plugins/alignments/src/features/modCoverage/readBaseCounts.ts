import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '@jbrowse/cigar-utils'

import { getStrand } from '../../shared/util.ts'
import { packedCigarOps } from '../alignedBaseWalk.ts'

import type { StrandBaseCounts } from '../../shared/calculateModificationCounts.ts'
import type { Feature } from '@jbrowse/core/util'

// Per-strand read-base pileup at the given genomic positions, built from each
// read's own sequence — no reference needed. modCoverage uses it as the
// modifiable/detectable denominator: at a cytosine it counts the reads showing
// C or G per strand, exactly as IGV's DenseAlignmentCounts does
// (BaseModificationCoverageRenderer reads getCount(pos, base) + complement off
// this same read-base pileup). SEQ is stored forward-reference-oriented, so the
// base read here is already in the forward frame.
//
// This was 33% of the RPC worker's busy time on `200x.longread.mod.bam` — the
// largest single cost in the modification render path — and is now ~7x faster
// there for identical output (`benches/readBaseCounts.bench.ts`, min of 30
// rotated rounds, byte-identical control at 1.00x; 3.8x on `20x.longread.mod`).
// Three things, in the order they matter:
//
// **Iterate the wanted COLUMNS, not every base.** `positions` is the set of
// modified columns, so sorting it once lets each M/=/X operation walk the
// columns it covers. The shape this replaced visited every reference-aligned
// base of every read and asked a bitmap whether anyone wanted it — 16.8M probes
// to answer 4.8M of them yes, on the fixture above. One binary search per read
// places the cursor and it then advances monotonically, since operations run
// left to right in reference order within a read.
//
// **A flat tally, not a Map of objects.** The `Map<pos, Record<base, {fwd,rev}>>`
// was asked once per wanted base, each lookup followed by two property probes.
// `(rank << 5) | (slot << 1) | strand` addresses a counter directly, and the Map
// is materialized once at the end over the columns that actually tallied
// something — which is what the caller still sees.
//
// **The packed CIGAR, not the string.** `packedCigarOps` reads `NUMERIC_CIGAR`,
// which for BAM is the on-disk layout handed over zero-copy. Reading
// `get('CIGAR')` and running `parseCigar2` over it asked the feature to BUILD a
// string out of the packed ops it already held and parsed it straight back into
// the same encoding — ~7,000 operations per 50kb ONT read, and for CRAM a
// `numericCigarToString` over an array it had just reconstructed. Every other
// per-base walk in this plugin was moved off the string form for this reason
// (`extractModifications` says so at its own call); this one was missed. A
// feature carrying only the text CIGAR still works — `packedCigarOps` parses it
// inside the helper — which is what the tests here exercise.
//
// Two things that went away with the per-base loop, so they are not missing:
// the `[minPos, maxPos]` clamp per operation (there is no per-base bound test
// left to hoist out of), and `MAX_BITMAP_SPAN`, which existed because the
// membership structure was indexed by genomic offset. A sorted column list is
// indexed by rank, so a sparse modBAM at a wide zoom now allocates for the
// columns it has rather than for the span they cover.

// BAM's whole SEQ alphabet, so a read storing an IUPAC code keys the output
// object by it exactly as reading `seq[i].toUpperCase()` did. `& ~0x20` is the
// upper-case fold; the NaN a past-the-end `charCodeAt` yields folds to 0 and is
// skipped, which is what the previous `if (base)` guard did.
const SEQ_ALPHABET = '=ACMGRSVTWYHKDBN'
const SLOT_OF_CODE = new Int8Array(128).fill(-1)
for (let i = 0; i < SEQ_ALPHABET.length; i++) {
  SLOT_OF_CODE[SEQ_ALPHABET.charCodeAt(i)] = i
}
const SLOTS = 16

export function computeReadBaseCounts(
  features: Feature[],
  positions: Set<number>,
) {
  const counts = new Map<number, StrandBaseCounts>()
  const n = positions.size
  if (n === 0) {
    return counts
  }
  const columns = new Uint32Array(n)
  let w = 0
  for (const p of positions) {
    columns[w++] = p
  }
  // TypedArray sort is numeric, unlike Array's
  columns.sort()
  const tally = new Uint32Array(n * SLOTS * 2)
  // A base outside BAM's alphabet, which only a SAM file can carry (the spec
  // allows `[A-Za-z=.]`). It has no slot, and rather than drop it — the previous
  // code keyed the output by whatever `toUpperCase` gave — it goes here, so the
  // fast path stays a table lookup and the answer is unconditionally the same.
  // Nothing under test has ever produced one.
  let rare: Map<number, StrandBaseCounts> | undefined

  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const ops = packedCigarOps(f)
    if (!seq || !ops?.length) {
      continue
    }
    const start = f.get('start')
    const strandBit = getStrand(f) === -1 ? 1 : 0

    // rank of the first column at or after this read's alignment start
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (columns[mid]! < start) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    let k = lo

    let readPos = 0
    let refPos = 0
    for (let i = 0, l = ops.length; i < l && k < n; i++) {
      const packed = ops[i]!
      const len = packed >> 4
      const op = packed & 0xf
      if (op === CIGAR_S || op === CIGAR_I) {
        readPos += len
      } else if (op === CIGAR_D || op === CIGAR_N) {
        refPos += len
      } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
        // M/=/X advance read and reference together, so a column's offset into
        // the operation is its offset into `seq` as well
        const opRef = start + refPos
        const opEnd = opRef + len
        while (k < n && columns[k]! < opRef) {
          k++
        }
        while (k < n && columns[k]! < opEnd) {
          const readIdx = readPos + columns[k]! - opRef
          const code = seq.charCodeAt(readIdx) & ~0x20
          const slot = SLOT_OF_CODE[code]!
          if (slot >= 0) {
            tally[(k << 5) | (slot << 1) | strandBit]!++
          } else if (code > 0) {
            rare ??= new Map()
            const pos = columns[k]!
            let sc = rare.get(pos)
            if (!sc) {
              sc = {}
              rare.set(pos, sc)
            }
            const entry = (sc[seq[readIdx]!.toUpperCase()] ??= {
              fwd: 0,
              rev: 0,
            })
            if (strandBit) {
              entry.rev++
            } else {
              entry.fwd++
            }
          }
          k++
        }
        readPos += len
        refPos += len
      }
    }
  }

  for (let i = 0; i < n; i++) {
    let sc: StrandBaseCounts | undefined
    const base = i << 5
    for (let s = 0; s < SLOTS; s++) {
      const fwd = tally[base | (s << 1)]!
      const rev = tally[base | (s << 1) | 1]!
      // A base with no reads is left out rather than emitted as a zero pair:
      // calculateModificationCounts sums `Object.values` for an 'N' modification,
      // so an entry that exists is an entry that counts.
      if (fwd !== 0 || rev !== 0) {
        sc ??= {}
        sc[SEQ_ALPHABET[s]!] = { fwd, rev }
      }
    }
    const extra = rare?.get(columns[i]!)
    if (extra) {
      sc = sc ? Object.assign(sc, extra) : extra
    }
    if (sc) {
      counts.set(columns[i]!, sc)
    }
  }
  return counts
}
