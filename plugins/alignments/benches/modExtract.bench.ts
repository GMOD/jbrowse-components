// What the per-read modification extraction costs, and how much of it is
// allocation rather than work.
//
//   node --expose-gc plugins/alignments/benches/modExtract.bench.ts --only=200x
//
// Flags: --rounds=<n> (default 30), --bam=<path>, --refName, --start, --end,
// --only=<fixture substring>
//
// The harness rules (interleave, min-of-rounds, a byte-identical control, an
// identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md. Read that before changing this.
//
// THE QUESTION. On six BAM tracks at chr22_mask:124000-143000 the RPC worker's
// hottest frame is `extractModifications`, and `WORKER_FINDINGS.md` put it at
// 14.6% of busy worker time on `200x.longread.mod.bam` alone — the largest
// named cost left there since `computeReadBaseCounts` was fixed. Three shapes
// on that path allocate once per modification CALL rather than once per read,
// and a nanopore pileup has hundreds of thousands of calls in a 19 kb window:
//
//   1. `getModProbabilities` returns `Array.from(ml, v => (+v + 0.5) / 256)`,
//      a boxed `number[]` per read
//   2. `getMaxProbModAtEachPosition` writes `{type, base, prob}` into a SPARSE
//      array indexed by reference offset — one object per winning position,
//      into an array V8 may push into dictionary mode
//   3. `extractModifications` pushes an 8-field `ModificationEntry` object per
//      visible call, which `buildModificationArrays` then filters (a second
//      array) and immediately flattens into typed arrays
//
// Nothing survives step 3 as an object: the RPC result is columnar. So the
// objects exist only to carry values between two loops in the same function.
//
// SIX ARMS, one a control, applied CUMULATIVELY so each row is what that step
// added on top of the one above it:
//   objects    — what ships today
//   +f32prob   — `Float32Array` probabilities. (N+0.5)/256 for N in 0..255 is
//                k/512 with k odd and k < 512, which float32 represents
//                exactly, so this is not a precision trade
//   +packedmax — the per-refpos winner as a packed number (type index in the
//                high bits, prob quantized in the low) in a dense typed array
//                over the read's own reference span, instead of an object in a
//                sparse one
//   +splitmax  — the same without quantizing: two dense arrays, a Float32Array
//                of probabilities and a Uint8Array of type indices
//   +mlbyte    — the same as +packedmax but EXACT, by carrying the raw ML byte
//                rather than a quantized float. This is what shipped
//   +columns   — plus growable typed-array columns instead of
//                `ModificationEntry[]`
//   control    — a second, separately-declared copy of `objects`
//
// WHAT IT SAYS, on `200x.longread.mod.bam` (285 MM reads, mean 50 kb, 148,045
// marks emitted), `--only=200x --rounds=20`:
//
//   +f32 prob   1.008x   <- nothing. The boxed number[] was not the cost
//   +packed max 3.976x   <- the sparse array of objects WAS
//   +split max  3.011x      a second dense array costs about a third of it back
//   +ml byte    4.008x   <- shipped
//   +columns    3.379x      a LOSS against +ml byte alone
//   control     0.994x
//
// On `--only=20x` (31 reads, 16,390 marks) the packed arms land at 2.5x, so the
// win grows with depth, which is the direction it needs to grow in.
//
// Two negative results worth keeping. **The `number[]` of probabilities is not
// the problem** — the first hypothesis, and it is worth ~1%; what costs is the
// object per POSITION, not the box per value. And **the columnar output is a
// regression** once the max array is fixed: `ModificationEntry` objects are
// short-lived and die in the nursery, while growable typed columns pay doubling
// copies and an intern lookup per push. `buildModificationArrays` flattening
// them in a second pass is cheaper than never building them.
//
// Written out longhand, six times. Do NOT refactor these into one driver
// parameterized by a flag: a shared driver makes the call site polymorphic and
// hands all the arms one set of inline caches, which has scored a
// byte-identical control at 1.14x in this repo's sibling benches.
//
// What IS shared, deliberately: `getModPositions` (the MM parse) and
// `getNextRefPos` (the CIGAR walk). Neither varies across the arms, both are
// library calls that every arm reaches identically, and BENCHMARKING.md's
// polymorphism trap is about arms reaching the *same* code by *different*
// routes. Sharing them keeps the diff to the three shapes under test.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { getNextRefPos } from '@jbrowse/cigar-utils'
import { getModPositions } from '@jbrowse/modifications-utils'

import type { BamRecord } from '@gmod/bam'
import type { ModWithPositions } from '@jbrowse/modifications-utils'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '30'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
// One dataset per process. See the same flag in readBaseCounts.bench.ts for
// why this is a correctness rule and not a convenience.
const ONLY = arg('only', '')

const THRESHOLD = 0.5

// A record's packed CIGAR and its MM/ML tags, read once outside the timed
// region — the real caller pays these per render too, but they are the same
// for every arm and would otherwise dominate what is being compared.
interface Read {
  index: number
  start: number
  strand: -1 | 0 | 1
  seq: string
  mm: string
  ml: ArrayLike<number>
  ops: Uint32Array | number[]
}

// ---------------------------------------------------------------------------
// ARM 1: objects — what ships today.

function probsObjects(ml: ArrayLike<number>) {
  return Array.from(ml, v => (+v + 0.5) / 256)
}

function maxProbObjects(
  mods: ModWithPositions[],
  probabilities: number[],
  ops: ArrayLike<number>,
  isRev: boolean,
) {
  const out: { type: string; base: string; prob: number }[] = []
  for (const mod of mods) {
    const { positions, probStart, probStride } = mod
    const posLen = positions.length
    getNextRefPos(ops, positions, (ref, idx) => {
      const mmOrder = isRev ? posLen - 1 - idx : idx
      const prob = probabilities[probStart + mmOrder * probStride] ?? 0
      const existing = out[ref]
      if (!existing || prob > existing.prob) {
        out[ref] = { type: mod.type, base: mod.base, prob }
      }
    })
  }
  return out
}

interface Entry {
  readIndex: number
  position: number
  base: string
  modType: string
  strand: number
  color: number
  prob: number
  noMod?: boolean
}

function runObjects(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    const probabilities = probsObjects(r.ml)
    const max = maxProbObjects(mods, probabilities, r.ops, r.strand === -1)
    const modStrand = r.strand === -1 ? -1 : 1
    max.forEach(({ prob, type, base }, refPos) => {
      if (prob >= THRESHOLD) {
        entries.push({
          readIndex: r.index,
          position: r.start + refPos,
          base,
          modType: type,
          strand: modStrand,
          color: 0,
          prob,
          noMod: false,
        })
      }
    })
  }
  return entries
}

// ---------------------------------------------------------------------------
// ARM 2: +f32prob

function probsF32(ml: ArrayLike<number>) {
  const n = ml.length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = (+ml[i]! + 0.5) / 256
  }
  return out
}

function maxProbObjects2(
  mods: ModWithPositions[],
  probabilities: Float32Array,
  ops: ArrayLike<number>,
  isRev: boolean,
) {
  const out: { type: string; base: string; prob: number }[] = []
  for (const mod of mods) {
    const { positions, probStart, probStride } = mod
    const posLen = positions.length
    getNextRefPos(ops, positions, (ref, idx) => {
      const mmOrder = isRev ? posLen - 1 - idx : idx
      const prob = probabilities[probStart + mmOrder * probStride] ?? 0
      const existing = out[ref]
      if (!existing || prob > existing.prob) {
        out[ref] = { type: mod.type, base: mod.base, prob }
      }
    })
  }
  return out
}

function runF32Prob(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    const probabilities = probsF32(r.ml)
    const max = maxProbObjects2(mods, probabilities, r.ops, r.strand === -1)
    const modStrand = r.strand === -1 ? -1 : 1
    max.forEach(({ prob, type, base }, refPos) => {
      if (prob >= THRESHOLD) {
        entries.push({
          readIndex: r.index,
          position: r.start + refPos,
          base,
          modType: type,
          strand: modStrand,
          color: 0,
          prob,
          noMod: false,
        })
      }
    })
  }
  return entries
}

// ---------------------------------------------------------------------------
// ARM 3: +packedmax
//
// The winner per reference offset as one number: `(modIndex + 1) << 20 | q`,
// where q is the probability quantized to 20 bits and modIndex indexes the
// read's own `mods` array (so `type`/`base` are recovered without storing
// either). Zero means "no call here", which is why modIndex is offset by one.
// Dense `Uint32Array` over [minRef, maxRef], so no sparse array and no
// dictionary-mode risk.
const Q_BITS = 20
const Q_MAX = (1 << Q_BITS) - 1

function runPackedMax(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    const probabilities = probsF32(r.ml)
    const isRev = r.strand === -1
    const modStrand = isRev ? -1 : 1

    // The read's reference span bounds the offsets getNextRefPos can emit.
    let span = 0
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      // D, N, M, X, = consume reference
      if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
        span += packed >>> 4
      }
    }
    const max = new Uint32Array(span + 1)
    let anyRef = -1
    let maxRef = -1
    for (let m = 0; m < mods.length; m++) {
      const mod = mods[m]!
      const { positions, probStart, probStride } = mod
      const posLen = positions.length
      const tag = (m + 1) << Q_BITS
      getNextRefPos(r.ops, positions, (ref, idx) => {
        const mmOrder = isRev ? posLen - 1 - idx : idx
        const prob = probabilities[probStart + mmOrder * probStride] ?? 0
        const q = (prob * Q_MAX) | 0
        const packed = tag | q
        const prev = max[ref]!
        if (prev === 0 || (prev & Q_MAX) < q) {
          max[ref] = packed
          if (anyRef < 0) {
            anyRef = ref
          }
          if (ref > maxRef) {
            maxRef = ref
          }
        }
      })
    }
    const qThreshold = (THRESHOLD * Q_MAX) | 0
    for (let ref = anyRef < 0 ? 1 : anyRef; ref <= maxRef; ref++) {
      const packed = max[ref]!
      if (packed === 0) {
        continue
      }
      const q = packed & Q_MAX
      if (q < qThreshold) {
        continue
      }
      const mod = mods[(packed >>> Q_BITS) - 1]!
      entries.push({
        readIndex: r.index,
        position: r.start + ref,
        base: mod.base,
        modType: mod.type,
        strand: modStrand,
        color: 0,
        prob: q / Q_MAX,
        noMod: false,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// ARM 4: +splitmax — the same idea as ARM 3 without the quantization.
//
// Two dense arrays instead of one packed: the probability in a `Float32Array`
// (exact for these values — see the +f32prob note) and the mod index in a
// `Uint8Array`, 0 meaning "no call". Costs one more allocation per read and
// buys back an exactly-identical `prob`, which matters because the value
// reaches the tooltip, not only the u8 alpha.

function runSplitMax(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    const probabilities = probsF32(r.ml)
    const isRev = r.strand === -1
    const modStrand = isRev ? -1 : 1

    let span = 0
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
        span += packed >>> 4
      }
    }
    const maxProb = new Float32Array(span + 1)
    const maxIdx = new Uint8Array(span + 1)
    let anyRef = -1
    let maxRef = -1
    for (let m = 0; m < mods.length; m++) {
      const mod = mods[m]!
      const { positions, probStart, probStride } = mod
      const posLen = positions.length
      const tag = m + 1
      getNextRefPos(r.ops, positions, (ref, idx) => {
        const mmOrder = isRev ? posLen - 1 - idx : idx
        const prob = probabilities[probStart + mmOrder * probStride] ?? 0
        if (maxIdx[ref] === 0 || prob > maxProb[ref]!) {
          maxIdx[ref] = tag
          maxProb[ref] = prob
          if (anyRef < 0) {
            anyRef = ref
          }
          if (ref > maxRef) {
            maxRef = ref
          }
        }
      })
    }
    for (let ref = anyRef < 0 ? 1 : anyRef; ref <= maxRef; ref++) {
      const tag = maxIdx[ref]!
      if (tag === 0) {
        continue
      }
      const prob = maxProb[ref]!
      if (prob < THRESHOLD) {
        continue
      }
      const mod = mods[tag - 1]!
      entries.push({
        readIndex: r.index,
        position: r.start + ref,
        base: mod.base,
        modType: mod.type,
        strand: modStrand,
        color: 0,
        prob,
        noMod: false,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// ARM 5: +mlbyte — packed like ARM 3, but exact, and half the memory.
//
// A probability on this path is ALWAYS `(N + 0.5) / 256` for a ML byte N, so
// the byte is a lossless stand-in for the float and is monotonic in it. Pack
// `(modIndex + 1) << 8 | N` into a `Uint16Array` and divide once, at the point
// of emit, for the handful of positions that survive the threshold — instead of
// dividing once per call and then storing the result.
//
// This removes the quantization argument ARM 3 needs, halves ARM 3's dense
// array, and makes `getModProbabilities`' whole `number[]` unnecessary on this
// path.

function runMlByte(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    const isRev = r.strand === -1
    const modStrand = isRev ? -1 : 1
    const ml = r.ml

    let span = 0
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
        span += packed >>> 4
      }
    }
    const max = new Uint16Array(span + 1)
    let anyRef = -1
    let maxRef = -1
    for (let m = 0; m < mods.length; m++) {
      const mod = mods[m]!
      const { positions, probStart, probStride } = mod
      const posLen = positions.length
      const tag = (m + 1) << 8
      getNextRefPos(r.ops, positions, (ref, idx) => {
        const mmOrder = isRev ? posLen - 1 - idx : idx
        const byte = ml[probStart + mmOrder * probStride] ?? 0
        const packed = tag | byte
        const prev = max[ref]!
        if (prev === 0 || (prev & 0xff) < byte) {
          max[ref] = packed
          if (anyRef < 0) {
            anyRef = ref
          }
          if (ref > maxRef) {
            maxRef = ref
          }
        }
      })
    }
    for (let ref = anyRef < 0 ? 1 : anyRef; ref <= maxRef; ref++) {
      const packed = max[ref]!
      if (packed === 0) {
        continue
      }
      const prob = ((packed & 0xff) + 0.5) / 256
      if (prob < THRESHOLD) {
        continue
      }
      const mod = mods[(packed >>> 8) - 1]!
      entries.push({
        readIndex: r.index,
        position: r.start + ref,
        base: mod.base,
        modType: mod.type,
        strand: modStrand,
        color: 0,
        prob,
        noMod: false,
      })
    }
  }
  return entries
}

// ---------------------------------------------------------------------------
// ARM 6: +columns
//
// No per-call object at all. Growable typed-array columns, which is the shape
// `buildModificationArrays` converts to anyway — so this removes both the
// objects and the second pass that flattens them.

class ModColumns {
  len = 0
  cap: number
  readIndex: Uint32Array
  position: Uint32Array
  prob: Float32Array
  typeIndex: Uint8Array
  strand: Int8Array
  noMod: Uint8Array
  types: string[] = []
  bases: string[] = []
  private typeIdx = new Map<string, number>()

  constructor(cap = 1024) {
    this.cap = cap
    this.readIndex = new Uint32Array(cap)
    this.position = new Uint32Array(cap)
    this.prob = new Float32Array(cap)
    this.typeIndex = new Uint8Array(cap)
    this.strand = new Int8Array(cap)
    this.noMod = new Uint8Array(cap)
  }

  private grow() {
    const cap = this.cap * 2
    const g = <T extends { set(a: any, o?: number): void; length: number }>(
      old: T,
      next: T,
    ) => {
      next.set(old as any)
      return next
    }
    this.readIndex = g(this.readIndex, new Uint32Array(cap))
    this.position = g(this.position, new Uint32Array(cap))
    this.prob = g(this.prob, new Float32Array(cap))
    this.typeIndex = g(this.typeIndex, new Uint8Array(cap))
    this.strand = g(this.strand, new Int8Array(cap))
    this.noMod = g(this.noMod, new Uint8Array(cap))
    this.cap = cap
  }

  internType(type: string, base: string) {
    let i = this.typeIdx.get(type)
    if (i === undefined) {
      i = this.types.length
      this.typeIdx.set(type, i)
      this.types.push(type)
      this.bases.push(base)
    }
    return i
  }

  push(
    readIndex: number,
    position: number,
    prob: number,
    typeIndex: number,
    strand: number,
    noMod: number,
  ) {
    if (this.len === this.cap) {
      this.grow()
    }
    const i = this.len++
    this.readIndex[i] = readIndex
    this.position[i] = position
    this.prob[i] = prob
    this.typeIndex[i] = typeIndex
    this.strand[i] = strand
    this.noMod[i] = noMod
  }
}

function runColumns(reads: Read[]) {
  const cols = new ModColumns()
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    const probabilities = probsF32(r.ml)
    const isRev = r.strand === -1
    const modStrand = isRev ? -1 : 1

    let span = 0
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
        span += packed >>> 4
      }
    }
    const max = new Uint32Array(span + 1)
    let anyRef = -1
    let maxRef = -1
    for (let m = 0; m < mods.length; m++) {
      const mod = mods[m]!
      const { positions, probStart, probStride } = mod
      const posLen = positions.length
      const tag = (m + 1) << Q_BITS
      getNextRefPos(r.ops, positions, (ref, idx) => {
        const mmOrder = isRev ? posLen - 1 - idx : idx
        const prob = probabilities[probStart + mmOrder * probStride] ?? 0
        const q = (prob * Q_MAX) | 0
        const packed = tag | q
        const prev = max[ref]!
        if (prev === 0 || (prev & Q_MAX) < q) {
          max[ref] = packed
          if (anyRef < 0) {
            anyRef = ref
          }
          if (ref > maxRef) {
            maxRef = ref
          }
        }
      })
    }
    const qThreshold = (THRESHOLD * Q_MAX) | 0
    for (let ref = anyRef < 0 ? 1 : anyRef; ref <= maxRef; ref++) {
      const packed = max[ref]!
      if (packed === 0) {
        continue
      }
      const q = packed & Q_MAX
      if (q < qThreshold) {
        continue
      }
      const mod = mods[(packed >>> Q_BITS) - 1]!
      cols.push(
        r.index,
        r.start + ref,
        q / Q_MAX,
        cols.internType(mod.type, mod.base),
        modStrand,
        0,
      )
    }
  }
  return cols
}

// ---------------------------------------------------------------------------
// ARM 5: control — a second, separately-declared copy of ARM 1.

function probsControl(ml: ArrayLike<number>) {
  return Array.from(ml, v => (+v + 0.5) / 256)
}

function maxProbControl(
  mods: ModWithPositions[],
  probabilities: number[],
  ops: ArrayLike<number>,
  isRev: boolean,
) {
  const out: { type: string; base: string; prob: number }[] = []
  for (const mod of mods) {
    const { positions, probStart, probStride } = mod
    const posLen = positions.length
    getNextRefPos(ops, positions, (ref, idx) => {
      const mmOrder = isRev ? posLen - 1 - idx : idx
      const prob = probabilities[probStart + mmOrder * probStride] ?? 0
      const existing = out[ref]
      if (!existing || prob > existing.prob) {
        out[ref] = { type: mod.type, base: mod.base, prob }
      }
    })
  }
  return out
}

function runControl(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    const probabilities = probsControl(r.ml)
    const max = maxProbControl(mods, probabilities, r.ops, r.strand === -1)
    const modStrand = r.strand === -1 ? -1 : 1
    max.forEach(({ prob, type, base }, refPos) => {
      if (prob >= THRESHOLD) {
        entries.push({
          readIndex: r.index,
          position: r.start + refPos,
          base,
          modType: type,
          strand: modStrand,
          color: 0,
          prob,
          noMod: false,
        })
      }
    })
  }
  return entries
}

// ---------------------------------------------------------------------------

// Canonical form both shapes serialize to, so the columnar arm is compared on
// what it MEANS rather than on how it stores it. Probability is compared at
// 3 decimals: the packed arms quantize to 20 bits and float32 rounds, and
// neither difference is one a drawn mark can show (`buildModificationArrays`
// puts prob into a u8 alpha).
function serialize(out: Entry[] | ModColumns) {
  const lines: string[] = []
  if (out instanceof ModColumns) {
    for (let i = 0; i < out.len; i++) {
      lines.push(
        `${out.readIndex[i]} ${out.position[i]} ${out.types[out.typeIndex[i]!]} ` +
          `${out.bases[out.typeIndex[i]!]} ${out.strand[i]} ` +
          `${out.prob[i]!.toFixed(3)} ${out.noMod[i]}`,
      )
    }
  } else {
    for (const e of out) {
      lines.push(
        `${e.readIndex} ${e.position} ${e.modType} ${e.base} ${e.strand} ` +
          `${e.prob.toFixed(3)} ${e.noMod ? 1 : 0}`,
      )
    }
  }
  return lines
}

function firstDifference(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return `length ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return `entry ${i}: "${a[i]}" vs "${b[i]}"`
    }
  }
  return ''
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function toReads(records: BamRecord[]): Read[] {
  const reads: Read[] = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!
    const mm = (r.getTag('MM') ?? r.getTag('Mm')) as string | undefined
    const ml = (r.getTag('ML') ?? r.getTag('Ml')) as
      | ArrayLike<number>
      | undefined
    if (!mm || !ml) {
      continue
    }
    reads.push({
      index: i,
      start: r.start,
      strand: r.strand === -1 ? -1 : 1,
      seq: r.seq,
      mm,
      ml,
      ops: r.NUMERIC_CIGAR as Uint32Array,
    })
  }
  return reads
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
        'trustworthy — see the --only= note in this file.\n',
    )
  }
  console.log(
    `modification extraction: objects vs typed columns\n` +
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
    const reads = toReads(records)
    if (reads.length === 0) {
      console.log(`${ds.name}: no MM/ML reads in range, skipped\n`)
      continue
    }

    // Warm every arm identically before timing — an arm that skipped this
    // would enter the loop with a monomorphic call site while the others had
    // gone polymorphic, which has scored a fake 0.61x control in this repo.
    const outObjects = serialize(runObjects(reads))
    const outF32 = serialize(runF32Prob(reads))
    const outPacked = serialize(runPackedMax(reads))
    const outSplit = serialize(runSplitMax(reads))
    const outMlByte = serialize(runMlByte(reads))
    const outColumns = serialize(runColumns(reads))
    const outControl = serialize(runControl(reads))

    const diffF32 = firstDifference(outObjects, outF32)
    const diffPacked = firstDifference(outObjects, outPacked)
    const diffSplit = firstDifference(outObjects, outSplit)
    const diffMlByte = firstDifference(outObjects, outMlByte)
    const diffColumns = firstDifference(outObjects, outColumns)
    const diffControl = firstDifference(outObjects, outControl)
    if (diffControl) {
      throw new Error(
        `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
      )
    }

    const best = {
      obj: Infinity,
      f32: Infinity,
      packed: Infinity,
      split: Infinity,
      mlb: Infinity,
      cols: Infinity,
      ctl: Infinity,
    }
    const sides = [
      { k: 'obj' as const, run: () => runObjects(reads) },
      { k: 'f32' as const, run: () => runF32Prob(reads) },
      { k: 'packed' as const, run: () => runPackedMax(reads) },
      { k: 'split' as const, run: () => runSplitMax(reads) },
      { k: 'mlb' as const, run: () => runMlByte(reads) },
      { k: 'cols' as const, run: () => runColumns(reads) },
      { k: 'ctl' as const, run: () => runControl(reads) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const x = (v: number) => `${(best.obj / v).toFixed(3)}x`
    const meanLen = reads.reduce((a, r) => a + r.seq.length, 0) / reads.length
    console.log(
      `${ds.name}\n` +
        `  ${reads.length} MM reads, mean ${Math.round(meanLen)} bp, ` +
        `${outObjects.length} marks emitted\n` +
        `  objects (ships) ${best.obj.toFixed(2).padStart(8)} ms\n` +
        `  +f32 prob       ${best.f32.toFixed(2).padStart(8)} ms   ${x(best.f32)}   ` +
        `output ${diffF32 ? `DIFFERS — ${diffF32}` : 'identical'}\n` +
        `  +packed max     ${best.packed.toFixed(2).padStart(8)} ms   ${x(best.packed)}   ` +
        `output ${diffPacked ? `DIFFERS — ${diffPacked}` : 'identical'}\n` +
        `  +split max      ${best.split.toFixed(2).padStart(8)} ms   ${x(best.split)}   ` +
        `output ${diffSplit ? `DIFFERS — ${diffSplit}` : 'identical'}\n` +
        `  +ml byte        ${best.mlb.toFixed(2).padStart(8)} ms   ${x(best.mlb)}   ` +
        `output ${diffMlByte ? `DIFFERS — ${diffMlByte}` : 'identical'}\n` +
        `  +columns        ${best.cols.toFixed(2).padStart(8)} ms   ${x(best.cols)}   ` +
        `output ${diffColumns ? `DIFFERS — ${diffColumns}` : 'identical'}\n` +
        `  control         ${best.ctl.toFixed(2).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
    )
  }
}

await main()
