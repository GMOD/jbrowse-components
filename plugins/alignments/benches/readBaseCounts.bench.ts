// Does `computeReadBaseCounts` need the CIGAR *string*?
//
//   node --expose-gc plugins/alignments/benches/readBaseCounts.bench.ts
//
// Flags: --rounds=<n> (default 40), --bam=<path>, --refName, --start, --end
//
// The harness rules (interleave, min-of-rounds, a byte-identical control, an
// identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md. Read that before changing this.
//
// THE QUESTION. `computeReadBaseCounts` is the modification-render path's
// per-strand base pileup, and its own header records it at 33% of the RPC
// worker's busy time on 200x.longread.mod.bam. It reads its CIGAR as
//
//   const cigar = f.get('CIGAR'); const ops = parseCigar2(cigar)
//
// i.e. it asks the feature to BUILD a CIGAR string out of the packed ops it
// already holds, then parses that string straight back into the same packed
// form. `parseCigar2`'s output is `(len << 4) | opIndex` over the BAM op order,
// which is what `NUMERIC_CIGAR` already is — so `packedCigarOps(f)` is the same
// array without the round trip. Every other per-base walk in this plugin
// (extractModifications, extractBisulfite, perBaseQuality, perBaseLetter) was
// already moved off the string form for exactly this reason; this one was
// missed.
//
// FOUR ARMS, one a control:
//   string    — what ships: get('CIGAR') + parseCigar2
//   packed    — packedCigarOps(f), everything else identical
//   packed+cc — packed, plus reading the base as a char code rather than
//               `seq[i]?.toUpperCase()` (a 1-char string + a case fold per
//               base, at every modified column of every read)
//   control   — a second, separately-declared copy of `string`
//
// Written out longhand, four times. Do NOT refactor these into one driver
// parameterized by a flag: a shared driver makes the call site polymorphic and
// hands all four arms one set of inline caches, which has scored a
// byte-identical control at 1.14x in this repo's sibling benches.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
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
  ]
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
    const outControl = serialize(runControl(features, positions))

    const diffPacked = firstDifference(outString, outPacked)
    const diffCharCode = firstDifference(outString, outCharCode)
    const diffTyped = firstDifference(outString, outTyped)
    const diffCursor = firstDifference(outString, outCursor)
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
      ctl: Infinity,
    }
    const sides = [
      { k: 'string' as const, run: () => runStringA(features, positions) },
      { k: 'packed' as const, run: () => runPacked(features, positions) },
      { k: 'cc' as const, run: () => runPackedCharCode(features, positions) },
      { k: 'typed' as const, run: () => runTyped(features, positions) },
      { k: 'cursor' as const, run: () => runCursor(features, positions) },
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
        `  control         ${best.ctl.toFixed(2).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
    )
  }
}

await main()
