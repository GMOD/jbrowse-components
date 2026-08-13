// Where `computeReadBaseCounts` spends its time, one step at a time.
//
//   node --expose-gc plugins/alignments/benches/readBaseCounts.bench.ts
//
// Flags: --rounds=<n> (default 40), --bam=<path>, --refName, --start, --end
//
// The harness rules (interleave, min-of-rounds, a byte-identical control, an
// identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md. Read that before changing this.
//
// THE QUESTION. `computeReadBaseCounts` is the modification render path's
// per-strand base pileup, and was 33% of the RPC worker's busy time on
// `200x.longread.mod.bam` — the largest single cost there. Four things about
// the shape it had looked wasteful. The arms apply them CUMULATIVELY, so each
// row is what that step added on top of the one above it, and the last one is
// what shipped.
//
// SIX ARMS, one a control:
//   string     — what shipped before `515d9d1306`: `get('CIGAR')` +
//                `parseCigar2`, a per-base walk gated by a bitmap, a
//                `Map<pos, Record<base, {fwd,rev}>>`
//   packed     — `packedCigarOps(f)` instead. The feature was being asked to
//                BUILD a CIGAR string out of the packed ops it already held so
//                that `parseCigar2` could parse it straight back into the same
//                `(len << 4) | opIndex` encoding
//   packed+cc  — plus the base as a char code, not `seq[i]?.toUpperCase()` (a
//                one-char string and a case fold at every wanted column)
//   +typed     — plus a flat `Uint32Array` tally addressed by
//                `(rank << 5) | (slot << 1) | strand`, instead of the Map
//   +cursor    — plus iterating the wanted COLUMNS rather than every base
//   +packedSEQ — plus reading the base out of `NUMERIC_SEQ`'s nibbles instead
//                of decoding `seq` to a string. **This one does not pay** —
//                see below. It is kept as an arm so the negative result stays
//                reproducible
//   control    — a second, separately-declared copy of `string`
//
// WHAT IT SAYS, on `200x.longread.mod.bam` (335 reads, mean 50 kb, 41,854
// modified columns) run with `--only=200x`, control 1.00x. The bracketed range
// is what three earlier all-fixtures-in-one-process runs gave, kept so the
// spread is visible:
//
//   packed      1.18x  [1.10-1.19]   the CIGAR round trip
//   packed+cc   1.40x  [1.25-1.51]
//   +typed      4.34x  [3.87-4.35]   <- the Map was the big one
//   +cursor     6.74x  [6.36-7.36]   <- and the per-base walk was the next
//   +packedSEQ  6.73x  [6.44-6.95]   parity with +cursor: NO WIN
//
// On `--only=20x` (36 reads, 10,472 columns): 1.37x / 1.68x / 2.55x / 3.68x,
// and +packedSEQ again at parity (3.77x).
//
// `+packedSEQ` is the interesting negative. Once the walk only visits the
// wanted columns it reads ~28% of a read's bases, so decoding the other 72%
// into a string looks like pure waste — and it is not, because the string
// decode is a `TextDecoder` pass at ~GB/s and `charCodeAt` on the flat result
// is one load, while the nibble path pays a shift, a mask and a second table
// indirection at every column. They trade evenly. Don't reintroduce it: it
// would also fork the function, since CRAM has no packed SEQ.
//
// Written out longhand, six times. Do NOT refactor these into one driver
// parameterized by a flag: a shared driver makes the call site polymorphic and
// hands all the arms one set of inline caches, which has scored a
// byte-identical control at 1.14x in this repo's sibling benches.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile, CHAR_CODE_FROM_NIBBLE } from '@gmod/bam'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  parseCigar2,
} from '@jbrowse/cigar-utils'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
// Run a single dataset, by substring of its name.
//
// **This is not a convenience flag.** Looping several datasets through the same
// arm function objects contaminates every dataset after the first: the arms'
// call sites have then seen more than one record population and never recover,
// while the baseline — which goes through the feature's own methods, already
// polymorphic — is unaffected. It reversed the sibling `tagAndSeq.probe.ts` by
// 1.7x, and the reversal followed POSITION rather than data (the two fixtures
// there are byte-identical in tag layout). Neither pre-warming every arm on
// every dataset nor releasing the other dataset's records recovers it; one
// process per dataset does. So the numbers in the header above were taken one
// `--only=` run at a time, and a fresh measurement should be too. See
// agent-docs/reference/BENCHMARKING.md.
const ONLY = arg('only', '')

// ---------------------------------------------------------------------------
// A minimal Feature over a BamRecord — just the accessors the function under
// test reads. The real BamSlightlyLazyFeature drags in @jbrowse/core; nothing
// here depends on the difference, and both arms see the identical object.
class Shim {
  r: BamRecord
  constructor(r: BamRecord) {
    this.r = r
  }
  get(field: string): unknown {
    switch (field) {
      case 'seq':
        return this.r.seq
      case 'CIGAR':
        return this.r.CIGAR
      case 'NUMERIC_CIGAR':
        return this.r.NUMERIC_CIGAR
      case 'start':
        return this.r.start
      case 'end':
        return this.r.end
      case 'strand':
        return this.r.strand
      case 'flags':
        return this.r.flags
      default:
        return undefined
    }
  }
  getTag(t: string) {
    return this.r.getTag(t)
  }
  getTagAlt(t: string, a: string) {
    return this.r.getTagAlt(t, a)
  }
}

interface StrandBaseCounts {
  [base: string]: { fwd: number; rev: number }
}

// ---------------------------------------------------------------------------
// The four arms. `runStringA` and `runControl` are identical on purpose; keep
// them that way when you change one.

function runStringA(features: Shim[], positions: Set<number>) {
  const counts = new Map<number, StrandBaseCounts>()
  if (positions.size === 0) {
    return counts
  }
  let minPos = Number.POSITIVE_INFINITY
  let maxPos = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (p < minPos) {
      minPos = p
    }
    if (p > maxPos) {
      maxPos = p
    }
  }
  const span = maxPos - minPos + 1
  const wanted = span <= 1 << 22 ? new Uint8Array(span) : undefined
  if (wanted) {
    for (const p of positions) {
      wanted[p - minPos] = 1
    }
  }
  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const cigar = f.get('CIGAR') as string | undefined
    if (seq && cigar) {
      const start = f.get('start') as number
      const fwd = f.get('strand') !== -1
      const ops = parseCigar2(cigar)
      let readPos = 0
      let refPos = 0
      for (let i = 0, l = ops.length; i < l; i++) {
        const packed = ops[i]!
        const len = packed >> 4
        const op = packed & 0xf
        if (op === CIGAR_S || op === CIGAR_I) {
          readPos += len
        } else if (op === CIGAR_D || op === CIGAR_N) {
          refPos += len
        } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
          const opRef = start + refPos
          let j = minPos - opRef
          if (j < 0) {
            j = 0
          }
          let jEnd = maxPos - opRef + 1
          if (jEnd > len) {
            jEnd = len
          }
          for (; j < jEnd; j++) {
            const pos = opRef + j
            if (wanted ? wanted[pos - minPos] === 1 : positions.has(pos)) {
              const base = seq[readPos + j]?.toUpperCase()
              if (base) {
                let sc = counts.get(pos)
                if (!sc) {
                  sc = {}
                  counts.set(pos, sc)
                }
                const entry = (sc[base] ??= { fwd: 0, rev: 0 })
                if (fwd) {
                  entry.fwd++
                } else {
                  entry.rev++
                }
              }
            }
          }
          readPos += len
          refPos += len
        }
      }
    }
  }
  return counts
}

function runPacked(features: Shim[], positions: Set<number>) {
  const counts = new Map<number, StrandBaseCounts>()
  if (positions.size === 0) {
    return counts
  }
  let minPos = Number.POSITIVE_INFINITY
  let maxPos = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (p < minPos) {
      minPos = p
    }
    if (p > maxPos) {
      maxPos = p
    }
  }
  const span = maxPos - minPos + 1
  const wanted = span <= 1 << 22 ? new Uint8Array(span) : undefined
  if (wanted) {
    for (const p of positions) {
      wanted[p - minPos] = 1
    }
  }
  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const numeric = f.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
    const ops =
      numeric ?? parseCigar2((f.get('CIGAR') as string | undefined) ?? '')
    if (seq && ops.length) {
      const start = f.get('start') as number
      const fwd = f.get('strand') !== -1
      let readPos = 0
      let refPos = 0
      for (let i = 0, l = ops.length; i < l; i++) {
        const packed = ops[i]!
        const len = packed >> 4
        const op = packed & 0xf
        if (op === CIGAR_S || op === CIGAR_I) {
          readPos += len
        } else if (op === CIGAR_D || op === CIGAR_N) {
          refPos += len
        } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
          const opRef = start + refPos
          let j = minPos - opRef
          if (j < 0) {
            j = 0
          }
          let jEnd = maxPos - opRef + 1
          if (jEnd > len) {
            jEnd = len
          }
          for (; j < jEnd; j++) {
            const pos = opRef + j
            if (wanted ? wanted[pos - minPos] === 1 : positions.has(pos)) {
              const base = seq[readPos + j]?.toUpperCase()
              if (base) {
                let sc = counts.get(pos)
                if (!sc) {
                  sc = {}
                  counts.set(pos, sc)
                }
                const entry = (sc[base] ??= { fwd: 0, rev: 0 })
                if (fwd) {
                  entry.fwd++
                } else {
                  entry.rev++
                }
              }
            }
          }
          readPos += len
          refPos += len
        }
      }
    }
  }
  return counts
}

// Same as `runPacked`, plus the base read as a char code. `& ~0x20` is the
// upper-case fold extractPerBaseLetter already uses; the string form allocates
// a one-char string and calls toUpperCase at every modified column of every
// read. The counts key stays a string so the output is comparable.
const BASE_CHARS = new Array<string>(128)
for (let i = 0; i < 128; i++) {
  BASE_CHARS[i] = String.fromCharCode(i)
}

function runPackedCharCode(features: Shim[], positions: Set<number>) {
  const counts = new Map<number, StrandBaseCounts>()
  if (positions.size === 0) {
    return counts
  }
  let minPos = Number.POSITIVE_INFINITY
  let maxPos = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (p < minPos) {
      minPos = p
    }
    if (p > maxPos) {
      maxPos = p
    }
  }
  const span = maxPos - minPos + 1
  const wanted = span <= 1 << 22 ? new Uint8Array(span) : undefined
  if (wanted) {
    for (const p of positions) {
      wanted[p - minPos] = 1
    }
  }
  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const numeric = f.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
    const ops =
      numeric ?? parseCigar2((f.get('CIGAR') as string | undefined) ?? '')
    if (seq && ops.length) {
      const start = f.get('start') as number
      const fwd = f.get('strand') !== -1
      let readPos = 0
      let refPos = 0
      for (let i = 0, l = ops.length; i < l; i++) {
        const packed = ops[i]!
        const len = packed >> 4
        const op = packed & 0xf
        if (op === CIGAR_S || op === CIGAR_I) {
          readPos += len
        } else if (op === CIGAR_D || op === CIGAR_N) {
          refPos += len
        } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
          const opRef = start + refPos
          let j = minPos - opRef
          if (j < 0) {
            j = 0
          }
          let jEnd = maxPos - opRef + 1
          if (jEnd > len) {
            jEnd = len
          }
          for (; j < jEnd; j++) {
            const pos = opRef + j
            if (wanted ? wanted[pos - minPos] === 1 : positions.has(pos)) {
              const code = seq.charCodeAt(readPos + j) & ~0x20
              if (code > 0) {
                let sc = counts.get(pos)
                if (!sc) {
                  sc = {}
                  counts.set(pos, sc)
                }
                const entry = (sc[BASE_CHARS[code]!] ??= { fwd: 0, rev: 0 })
                if (fwd) {
                  entry.fwd++
                } else {
                  entry.rev++
                }
              }
            }
          }
          readPos += len
          refPos += len
        }
      }
    }
  }
  return counts
}

// Same walk again, but the accumulator is a flat Uint32Array instead of a
// `Map<number, Record<base, {fwd,rev}>>`.
//
// The Map is asked once per WANTED BASE, not once per read: at 200x long-read
// modBAM that is ~4.8M lookups, each followed by a property probe on a
// per-position object and a property probe on a per-base one. A dense
// `Int32Array` position index turns the bitmap probe and the Map lookup into
// one typed-array read, and `(slot << 1) | strand` addresses the counter
// directly. The Map is materialized once at the end, over the wanted columns
// only, so what the caller sees is unchanged.
//
// 16 base slots, i.e. BAM's whole SEQ alphabet (=ACMGRSVTWYHKDBN) — a read may
// legitimately store an IUPAC code, and the shipped version would key the
// output object by it.
const SEQ_ALPHABET = '=ACMGRSVTWYHKDBN'
const SLOT_OF_CODE = new Int8Array(128).fill(-1)
for (let i = 0; i < SEQ_ALPHABET.length; i++) {
  SLOT_OF_CODE[SEQ_ALPHABET.charCodeAt(i)] = i
}

function runTyped(features: Shim[], positions: Set<number>) {
  const counts = new Map<number, StrandBaseCounts>()
  if (positions.size === 0) {
    return counts
  }
  let minPos = Number.POSITIVE_INFINITY
  let maxPos = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (p < minPos) {
      minPos = p
    }
    if (p > maxPos) {
      maxPos = p
    }
  }
  const span = maxPos - minPos + 1
  if (span > 1 << 22) {
    // the shipped fallback: too wide to index densely
    return runStringA(features, positions)
  }
  // -1 everywhere except the wanted columns, which hold their own dense index
  const index = new Int32Array(span).fill(-1)
  const sorted = [...positions].sort((a, b) => a - b)
  for (let i = 0; i < sorted.length; i++) {
    index[sorted[i]! - minPos] = i
  }
  const tally = new Uint32Array(sorted.length * 32)

  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const numeric = f.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
    const ops =
      numeric ?? parseCigar2((f.get('CIGAR') as string | undefined) ?? '')
    if (seq && ops.length) {
      const start = f.get('start') as number
      const strandBit = f.get('strand') === -1 ? 1 : 0
      let readPos = 0
      let refPos = 0
      for (let i = 0, l = ops.length; i < l; i++) {
        const packed = ops[i]!
        const len = packed >> 4
        const op = packed & 0xf
        if (op === CIGAR_S || op === CIGAR_I) {
          readPos += len
        } else if (op === CIGAR_D || op === CIGAR_N) {
          refPos += len
        } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
          const opRef = start + refPos
          let j = minPos - opRef
          if (j < 0) {
            j = 0
          }
          let jEnd = maxPos - opRef + 1
          if (jEnd > len) {
            jEnd = len
          }
          for (; j < jEnd; j++) {
            const idx = index[opRef + j - minPos]!
            if (idx >= 0) {
              const slot = SLOT_OF_CODE[seq.charCodeAt(readPos + j) & ~0x20]!
              if (slot >= 0) {
                tally[(idx << 5) | (slot << 1) | strandBit]!++
              }
            }
          }
          readPos += len
          refPos += len
        }
      }
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    let sc: StrandBaseCounts | undefined
    const base = i << 5
    for (let s = 0; s < 16; s++) {
      const fwd = tally[base | (s << 1)]!
      const rev = tally[base | (s << 1) | 1]!
      if (fwd !== 0 || rev !== 0) {
        sc ??= {}
        sc[SEQ_ALPHABET[s]!] = { fwd, rev }
      }
    }
    if (sc) {
      counts.set(sorted[i]!, sc)
    }
  }
  return counts
}

// The same typed tally, but iterating the WANTED COLUMNS instead of every base.
//
// The shipped shape visits every reference-aligned base of every read and asks a
// bitmap whether anyone wanted it — 16.8M probes on the 200x long-read fixture
// to answer 4.8M of them yes. The modified columns are already a set, so sorting
// them once lets each CIGAR op walk the columns it covers instead: one binary
// search per read to place the cursor, then a monotonic advance, since ops run
// left to right in reference order within a read.
//
// It also removes the reason MAX_BITMAP_SPAN exists. The span guard is there
// because the membership structure was indexed by genomic offset; a sorted
// column list is indexed by rank, so a sparse modBAM at a wide zoom allocates
// one Uint32Array of the columns it actually has.
function runCursor(features: Shim[], positions: Set<number>) {
  const counts = new Map<number, StrandBaseCounts>()
  const n = positions.size
  if (n === 0) {
    return counts
  }
  const sorted = new Uint32Array(n)
  let w = 0
  for (const p of positions) {
    sorted[w++] = p
  }
  sorted.sort()
  const tally = new Uint32Array(n * 32)

  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const numeric = f.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
    const ops =
      numeric ?? parseCigar2((f.get('CIGAR') as string | undefined) ?? '')
    if (!seq || !ops.length) {
      continue
    }
    const start = f.get('start') as number
    const strandBit = f.get('strand') === -1 ? 1 : 0
    // first column at or after this read's alignment start
    let lo = 0
    let hi = n
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (sorted[mid]! < start) {
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
        const opRef = start + refPos
        const opEnd = opRef + len
        while (k < n && sorted[k]! < opRef) {
          k++
        }
        while (k < n && sorted[k]! < opEnd) {
          const slot =
            SLOT_OF_CODE[seq.charCodeAt(readPos + sorted[k]! - opRef) & ~0x20]!
          if (slot >= 0) {
            tally[(k << 5) | (slot << 1) | strandBit]!++
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
    for (let s = 0; s < 16; s++) {
      const fwd = tally[base | (s << 1)]!
      const rev = tally[base | (s << 1) | 1]!
      if (fwd !== 0 || rev !== 0) {
        sc ??= {}
        sc[SEQ_ALPHABET[s]!] = { fwd, rev }
      }
    }
    if (sc) {
      counts.set(sorted[i]!, sc)
    }
  }
  return counts
}

// Same again, but the base comes out of the PACKED sequence rather than the
// decoded string. `NUMERIC_SEQ` is BAM's on-disk 4-bit SEQ handed over
// zero-copy, and `CHAR_CODE_FROM_NIBBLE` (exported by @gmod/bam for exactly
// this — reading a base back out of a packed region) turns a nibble into the
// upper-case char code the slot table already keys on. So a read whose wanted
// columns are 14k of its 50k bases stops decoding all 50k into a string it
// samples 28% of. CRAM has no packed SEQ — its `getReadBases()` is a string,
// and a cached one — so a feature without `NUMERIC_SEQ` keeps the string path.
function runNibble(features: Shim[], positions: Set<number>) {
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
  columns.sort()
  const tally = new Uint32Array(n * 32)

  for (const f of features) {
    const numericSeq = f.get('NUMERIC_SEQ') as Uint8Array | undefined
    const seq = numericSeq ? undefined : (f.get('seq') as string | undefined)
    const numeric = f.get('NUMERIC_CIGAR') as ArrayLike<number> | undefined
    const ops =
      numeric ?? parseCigar2((f.get('CIGAR') as string | undefined) ?? '')
    if ((!numericSeq && !seq) || !ops.length) {
      continue
    }
    const start = f.get('start') as number
    const strandBit = f.get('strand') === -1 ? 1 : 0
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
        const opRef = start + refPos
        const opEnd = opRef + len
        while (k < n && columns[k]! < opRef) {
          k++
        }
        if (numericSeq) {
          while (k < n && columns[k]! < opEnd) {
            const idx = readPos + columns[k]! - opRef
            const nibble =
              (numericSeq[idx >> 1]! >> ((1 - (idx & 1)) << 2)) & 0xf
            const slot = SLOT_OF_CODE[CHAR_CODE_FROM_NIBBLE[nibble]!]!
            if (slot >= 0) {
              tally[(k << 5) | (slot << 1) | strandBit]!++
            }
            k++
          }
        } else {
          while (k < n && columns[k]! < opEnd) {
            const code = seq!.charCodeAt(readPos + columns[k]! - opRef) & ~0x20
            const slot = SLOT_OF_CODE[code]!
            if (slot >= 0) {
              tally[(k << 5) | (slot << 1) | strandBit]!++
            }
            k++
          }
        }
        readPos += len
        refPos += len
      }
    }
  }

  for (let i = 0; i < n; i++) {
    let sc: StrandBaseCounts | undefined
    const base = i << 5
    for (let s2 = 0; s2 < 16; s2++) {
      const fwd = tally[base | (s2 << 1)]!
      const rev = tally[base | (s2 << 1) | 1]!
      if (fwd !== 0 || rev !== 0) {
        sc ??= {}
        sc[SEQ_ALPHABET[s2]!] = { fwd, rev }
      }
    }
    if (sc) {
      counts.set(columns[i]!, sc)
    }
  }
  return counts
}

function runControl(features: Shim[], positions: Set<number>) {
  const counts = new Map<number, StrandBaseCounts>()
  if (positions.size === 0) {
    return counts
  }
  let minPos = Number.POSITIVE_INFINITY
  let maxPos = Number.NEGATIVE_INFINITY
  for (const p of positions) {
    if (p < minPos) {
      minPos = p
    }
    if (p > maxPos) {
      maxPos = p
    }
  }
  const span = maxPos - minPos + 1
  const wanted = span <= 1 << 22 ? new Uint8Array(span) : undefined
  if (wanted) {
    for (const p of positions) {
      wanted[p - minPos] = 1
    }
  }
  for (const f of features) {
    const seq = f.get('seq') as string | undefined
    const cigar = f.get('CIGAR') as string | undefined
    if (seq && cigar) {
      const start = f.get('start') as number
      const fwd = f.get('strand') !== -1
      const ops = parseCigar2(cigar)
      let readPos = 0
      let refPos = 0
      for (let i = 0, l = ops.length; i < l; i++) {
        const packed = ops[i]!
        const len = packed >> 4
        const op = packed & 0xf
        if (op === CIGAR_S || op === CIGAR_I) {
          readPos += len
        } else if (op === CIGAR_D || op === CIGAR_N) {
          refPos += len
        } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
          const opRef = start + refPos
          let j = minPos - opRef
          if (j < 0) {
            j = 0
          }
          let jEnd = maxPos - opRef + 1
          if (jEnd > len) {
            jEnd = len
          }
          for (; j < jEnd; j++) {
            const pos = opRef + j
            if (wanted ? wanted[pos - minPos] === 1 : positions.has(pos)) {
              const base = seq[readPos + j]?.toUpperCase()
              if (base) {
                let sc = counts.get(pos)
                if (!sc) {
                  sc = {}
                  counts.set(pos, sc)
                }
                const entry = (sc[base] ??= { fwd: 0, rev: 0 })
                if (fwd) {
                  entry.fwd++
                } else {
                  entry.rev++
                }
              }
            }
          }
          readPos += len
          refPos += len
        }
      }
    }
  }
  return counts
}

// ---------------------------------------------------------------------------

function serialize(counts: Map<number, StrandBaseCounts>) {
  const out: string[] = []
  for (const pos of [...counts.keys()].sort((a, b) => a - b)) {
    const sc = counts.get(pos)!
    for (const base of Object.keys(sc).sort()) {
      out.push(`${pos}:${base}:${sc[base]!.fwd}:${sc[base]!.rev}`)
    }
  }
  return out
}

function firstDifference(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return `entry count ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return `entry ${i}: ${a[i]} vs ${b[i]}`
    }
  }
  return undefined
}

const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

// The modified columns, as the worker builds them: every reference position any
// read reports a modification at. Derived from the MM tag the same way
// getModPositions does, walked onto the reference through the packed CIGAR —
// enough to reproduce the SHAPE of the real `positions` set (its size and its
// span), which is all this function's cost depends on.
function modifiedPositions(records: BamRecord[]) {
  const positions = new Set<number>()
  for (const r of records) {
    const mm = (r.getTagAlt('MM', 'Mm') ?? r.getTagAlt('MM', 'Mm')) as
      | string
      | undefined
    if (!mm) {
      continue
    }
    const seq = r.seq
    const isRev = r.strand === -1
    const len = seq.length
    // read offsets carrying a call, per MM group
    const readOffsets = new Set<number>()
    for (const group of mm.split(';')) {
      if (!group) {
        continue
      }
      const split = group.split(',')
      const header = split[0]!
      const base = header[0]!
      const target = isRev
        ? ({ A: 'T', T: 'A', C: 'G', G: 'C', N: 'N' }[base] ?? base)
        : base
      let currPos = 0
      for (let i = 1; i < split.length; i++) {
        let delta = +split[i]!
        do {
          const c = isRev ? seq[len - 1 - currPos] : seq[currPos]
          if (base === 'N' || c === target) {
            delta--
          }
          currPos++
        } while (delta >= 0 && currPos < len)
        readOffsets.add(isRev ? len - currPos : currPos - 1)
      }
    }
    // read offsets -> reference positions through the CIGAR
    const ops = r.NUMERIC_CIGAR
    let readPos = 0
    let refPos = 0
    for (let i = 0, l = ops.length; i < l; i++) {
      const packed = ops[i]!
      const oplen = packed >> 4
      const op = packed & 0xf
      if (op === CIGAR_S || op === CIGAR_I) {
        readPos += oplen
      } else if (op === CIGAR_D || op === CIGAR_N) {
        refPos += oplen
      } else if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
        for (let j = 0; j < oplen; j++) {
          if (readOffsets.has(readPos + j)) {
            positions.add(r.start + refPos + j)
          }
        }
        readPos += oplen
        refPos += oplen
      }
    }
  }
  return positions
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const datasets = [
    { name: '20x.longread.mod.bam', file: '20x.longread.mod.bam' },
    { name: '200x.longread.mod.bam', file: '200x.longread.mod.bam' },
  ].filter(d => d.name.includes(ONLY))
  if (!ONLY && datasets.length > 1) {
    console.log(
      'NOTE: running every dataset in one process. Only the FIRST row is\n' +
        'trustworthy — see the --only= note in this file. Re-run per dataset\n' +
        'before quoting a number.\n',
    )
  }
  console.log(
    `computeReadBaseCounts: CIGAR string vs packed ops\n` +
      `${REFNAME}:${START}-${END}, min of ${ROUNDS} rotated rounds\n`,
  )
  for (const ds of datasets) {
    const path = join(BAM, ds.file)
    try {
      readFileSync(path, { flag: 'r' })
    } catch {
      console.log(`${ds.name}: not present at ${path}, skipped\n`)
      continue
    }
    const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
    await bam.getHeader()
    const records = await bam.getRecordsForRange(REFNAME, START, END)
    if (records.length === 0) {
      console.log(`${ds.name}: no records in range, skipped\n`)
      continue
    }
    const positions = modifiedPositions(records)
    const features = records.map(r => new Shim(r))

    // Warm every arm identically before timing — an arm that skipped this
    // would enter the loop with a monomorphic call site while the others had
    // gone polymorphic, which has scored a fake 0.61x control in this repo.
    const outString = serialize(runStringA(features, positions))
    const outPacked = serialize(runPacked(features, positions))
    const outCharCode = serialize(runPackedCharCode(features, positions))
    const outTyped = serialize(runTyped(features, positions))
    const outCursor = serialize(runCursor(features, positions))
    const outNibble = serialize(runNibble(features, positions))
    const outControl = serialize(runControl(features, positions))

    const diffPacked = firstDifference(outString, outPacked)
    const diffCharCode = firstDifference(outString, outCharCode)
    const diffTyped = firstDifference(outString, outTyped)
    const diffCursor = firstDifference(outString, outCursor)
    const diffNibble = firstDifference(outString, outNibble)
    const diffControl = firstDifference(outString, outControl)
    if (diffControl) {
      throw new Error(
        `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
      )
    }

    const best = {
      string: Infinity,
      packed: Infinity,
      cc: Infinity,
      typed: Infinity,
      cursor: Infinity,
      nibble: Infinity,
      ctl: Infinity,
    }
    const sides = [
      { k: 'string' as const, run: () => runStringA(features, positions) },
      { k: 'packed' as const, run: () => runPacked(features, positions) },
      { k: 'cc' as const, run: () => runPackedCharCode(features, positions) },
      { k: 'typed' as const, run: () => runTyped(features, positions) },
      { k: 'cursor' as const, run: () => runCursor(features, positions) },
      { k: 'nibble' as const, run: () => runNibble(features, positions) },
      { k: 'ctl' as const, run: () => runControl(features, positions) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const x = (v: number) => `${(best.string / v).toFixed(3)}x`
    const meanLen =
      records.reduce((a, r) => a + r.seq_length, 0) / records.length
    console.log(
      `${ds.name}\n` +
        `  ${records.length} reads, mean ${Math.round(meanLen)} bp, ` +
        `${positions.size} modified columns\n` +
        `  string (ships)  ${best.string.toFixed(2).padStart(8)} ms\n` +
        `  packed          ${best.packed.toFixed(2).padStart(8)} ms   ${x(best.packed)}   ` +
        `output ${diffPacked ? `DIFFERS — ${diffPacked}` : 'identical'}\n` +
        `  packed+charcode ${best.cc.toFixed(2).padStart(8)} ms   ${x(best.cc)}   ` +
        `output ${diffCharCode ? `DIFFERS — ${diffCharCode}` : 'identical'}\n` +
        `  +typed tally    ${best.typed.toFixed(2).padStart(8)} ms   ${x(best.typed)}   ` +
        `output ${diffTyped ? `DIFFERS — ${diffTyped}` : 'identical'}\n` +
        `  +column cursor  ${best.cursor.toFixed(2).padStart(8)} ms   ${x(best.cursor)}   ` +
        `output ${diffCursor ? `DIFFERS — ${diffCursor}` : 'identical'}\n` +
        `  +packed SEQ     ${best.nibble.toFixed(2).padStart(8)} ms   ${x(best.nibble)}   ` +
        `output ${diffNibble ? `DIFFERS — ${diffNibble}` : 'identical'}\n` +
        `  control         ${best.ctl.toFixed(2).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
    )
  }
}

await main()
