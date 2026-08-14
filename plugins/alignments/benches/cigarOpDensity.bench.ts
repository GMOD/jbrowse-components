// Does the cursor walk's advantage depend on how many CIGAR ops a read carries?
//
//   node --expose-gc plugins/alignments/benches/cigarOpDensity.bench.ts --ops=real
//   node --expose-gc plugins/alignments/benches/cigarOpDensity.bench.ts --ops=64
//
// Flags: --rounds=<n> (default 30), --bam=<dir>, --refName, --start, --end,
// --ops=<real|N>  ops per read; `real` keeps each read's own CIGAR
//
// The harness rules are in agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION, and it is one this repo asserted before measuring.
// `cigarWalkShape.bench.ts` measured the per-position cursor walk at 1.17x over
// the per-base walk on the whole per-read modification pipeline, and its header
// then claimed that number is close to a FLOOR — reasoning that the op loop,
// which neither shape avoids, is what caps it, and that a technology with fewer
// ops per read (PacBio HiFi, which is what Fiber-seq is) would show more. It also
// said that was "not measurable here, because no fixture in either corpus is
// HiFi".
//
// **That second part was wrong, and this bench is the correction.** Op density is
// the one variable that can be synthesized honestly: replace each read's CIGAR
// with one holding the same read length in a chosen number of ops, and hold the
// reads, the MM tags, the ML values and the positions fixed. Both arms then see
// the same synthetic CIGAR, so the comparison is exact — what is synthetic is the
// alignment, not the measurement.
//
// The corpus sits at ~7,081 ops per read, an op every 7 bases. HiFi is orders of
// magnitude below that. `--ops=` sweeps it.
//
// **ONE DENSITY PER PROCESS.** Each is a distinct fixture as far as V8 is
// concerned and BENCHMARKING.md's dataset-contamination entry is about exactly
// that: looping several through the same arm functions reported a 0.73x where
// one-per-process gives 1.22x, and the reversal followed position rather than
// data.
//
// THREE ARMS, each the whole per-read pipeline so the ratio is comparable with
// cigarWalkShape's:
//   perBase     — the loop over every read base an op spans
//   perPosition — the cursor walk. Shipped
//   control     — a second, separately-declared copy of `perBase`
//
// `getModPositions` is SHARED rather than copied, deliberately: it does not vary
// across the arms, every arm reaches it identically, and BENCHMARKING.md's
// polymorphism trap is about arms reaching the same code by DIFFERENT routes.
// Same call as modExtract.bench.ts makes, for the same reason.
//
// WHAT IT SAYS, full extent of `200x.longread.mod.bam` (883 MM reads, 43.7 Mbp,
// 0.84M calls), `--rounds=25`, 2026-08-14 at load 3-7, output identical in every
// row:
//
//   ops/read   one op every   per base   per position            control
//          1     49,449 bp    495.4 ms   420.3 ms      1.179x    0.998
//         64        785 bp    470.8 ms   408.4 ms      1.153x    0.993
//        256      193.9 bp    459.0 ms   403.7 ms      1.137x    1.000
//      1,000       49.5 bp    505.4 ms   458.0 ms      1.103x    1.023
//   7,081 (real)    7.0 bp    527.9 ms   468.4 ms      1.127x    0.985
//
// **FLAT, across a 5,000x range of op density — and that refutes the claim this
// bench was written to check.** `cigarWalkShape.bench.ts` said its 1.17x was near
// a floor because the op loop caps it, and that HiFi would show much more. It does
// not: at one op per read, where the per-base walk visits 43.7M bases and the
// cursor walk visits 0.84M positions and a single op — a 52x difference in
// iterations, the theoretical maximum for this change — the pipeline ratio is
// 1.179x. The row-to-row spread is smaller than the controls' own spread.
//
// The reason, and it generalises past this function: **the walk phase is
// dominated by per-CALL work, not by scanning.** Both shapes invoke the callback
// 0.84M times, look up the same ML bytes, run the same comparisons and write the
// same `best[ref]` slots. Only the scan differs, and the scan is the minority of
// the phase — which is why removing 99.99% of the op iterations moves the total by
// about 5%. The same conclusion as this repo's `stackBar` scratch-array entry in
// REJECTED_IDEAS.md, arrived at on a different path: what scales here is per-call
// work, and a shape that only changes the traversal has a low ceiling.
//
// So the cursor walk is worth ~1.1-1.18x and that is the whole of it, at any op
// density. Keep it — it is free and it is never worse — but do not expect a
// technology change to widen it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
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
const START = Number(arg('start', '1'))
const END = Number(arg('end', '400000'))
const OPS = arg('ops', 'real')

const THRESHOLD = 0.5

interface Read {
  index: number
  start: number
  strand: -1 | 0 | 1
  seq: string
  mm: string
  ml: ArrayLike<number>
  ops: Uint32Array | number[]
}

interface Entry {
  readIndex: number
  position: number
  base: string
  modType: string
  prob: number
}

// ---------------------------------------------------------------------------
// ARM 1: perBase

function walkPerBase(
  cigarOps: ArrayLike<number>,
  positions: number[],
  callback: (ref: number, idx: number) => void,
) {
  let readPos = 0
  let refPos = 0
  let currPos = 0
  for (
    let i = 0, l = cigarOps.length, l2 = positions.length;
    i < l && currPos < l2;
    i++
  ) {
    const packed = cigarOps[i]!
    const len = packed >>> 4
    const op = packed & 0xf
    if (op === 4 || op === 1) {
      for (let j = 0; j < len && currPos < l2; j++) {
        if (positions[currPos] === readPos + j) {
          currPos++
        }
      }
      readPos += len
    } else if (op === 2 || op === 3) {
      refPos += len
    } else if (op === 0 || op === 8 || op === 7) {
      for (let j = 0; j < len && currPos < l2; j++) {
        if (positions[currPos] === readPos + j) {
          callback(refPos + j, currPos)
          currPos++
        }
      }
      readPos += len
      refPos += len
    }
  }
}

function runPerBase(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    emitPerBase(r, mods, entries)
  }
  return entries
}

function emitPerBase(r: Read, mods: ModWithPositions[], entries: Entry[]) {
  const isRev = r.strand === -1
  const ml = r.ml
  const nMods = mods.length
  if (nMods === 0) {
    return
  }
  let span = 0
  for (let i = 0, l = r.ops.length; i < l; i++) {
    const packed = r.ops[i]!
    const op = packed & 0xf
    if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
      span += packed >>> 4
    }
  }
  const best = new Uint16Array(span + 1)
  let firstRef = -1
  let lastRef = -1
  for (let m = 0; m < nMods;) {
    const mod = mods[m]!
    const positions = mod.positions
    let end = m + 1
    while (end < nMods && mods[end]!.positions === positions) {
      end++
    }
    const posLen = positions.length
    const groupStart = m
    const groupEnd = end
    walkPerBase(r.ops, positions, (ref, idx) => {
      const mmOrder = isRev ? posLen - 1 - idx : idx
      let bestByte = -1
      let bestIdx = groupStart
      for (let k = groupStart; k < groupEnd; k++) {
        const g = mods[k]!
        const byte = ml[g.probStart + mmOrder * g.probStride] ?? 0
        if (byte > bestByte) {
          bestByte = byte
          bestIdx = k
        }
      }
      const prev = best[ref]!
      if (prev === 0 || (prev & 0xff) < bestByte) {
        best[ref] = ((bestIdx + 1) << 8) | bestByte
        if (firstRef < 0 || ref < firstRef) {
          firstRef = ref
        }
        if (ref > lastRef) {
          lastRef = ref
        }
      }
    })
    m = end
  }
  if (firstRef < 0) {
    return
  }
  for (let ref = firstRef; ref <= lastRef; ref++) {
    const packed = best[ref]!
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
      prob,
    })
  }
}

// ---------------------------------------------------------------------------
// ARM 2: perPosition

function walkPerPosition(
  cigarOps: ArrayLike<number>,
  positions: number[],
  callback: (ref: number, idx: number) => void,
) {
  const l2 = positions.length
  if (l2 === 0) {
    return
  }
  let readPos = 0
  let refPos = 0
  let currPos = 0
  for (let i = 0, l = cigarOps.length; i < l && currPos < l2; i++) {
    const packed = cigarOps[i]!
    const len = packed >>> 4
    const op = packed & 0xf
    if (op === 4 || op === 1) {
      const readEnd = readPos + len
      while (currPos < l2 && positions[currPos]! < readEnd) {
        currPos++
      }
      readPos = readEnd
    } else if (op === 2 || op === 3) {
      refPos += len
    } else if (op === 0 || op === 8 || op === 7) {
      const readEnd = readPos + len
      const delta = refPos - readPos
      while (currPos < l2 && positions[currPos]! < readEnd) {
        callback(positions[currPos]! + delta, currPos)
        currPos++
      }
      readPos = readEnd
      refPos += len
    }
  }
}

function runPerPosition(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    emitPerPosition(r, mods, entries)
  }
  return entries
}

function emitPerPosition(r: Read, mods: ModWithPositions[], entries: Entry[]) {
  const isRev = r.strand === -1
  const ml = r.ml
  const nMods = mods.length
  if (nMods === 0) {
    return
  }
  let span = 0
  for (let i = 0, l = r.ops.length; i < l; i++) {
    const packed = r.ops[i]!
    const op = packed & 0xf
    if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
      span += packed >>> 4
    }
  }
  const best = new Uint16Array(span + 1)
  let firstRef = -1
  let lastRef = -1
  for (let m = 0; m < nMods;) {
    const mod = mods[m]!
    const positions = mod.positions
    let end = m + 1
    while (end < nMods && mods[end]!.positions === positions) {
      end++
    }
    const posLen = positions.length
    const groupStart = m
    const groupEnd = end
    walkPerPosition(r.ops, positions, (ref, idx) => {
      const mmOrder = isRev ? posLen - 1 - idx : idx
      let bestByte = -1
      let bestIdx = groupStart
      for (let k = groupStart; k < groupEnd; k++) {
        const g = mods[k]!
        const byte = ml[g.probStart + mmOrder * g.probStride] ?? 0
        if (byte > bestByte) {
          bestByte = byte
          bestIdx = k
        }
      }
      const prev = best[ref]!
      if (prev === 0 || (prev & 0xff) < bestByte) {
        best[ref] = ((bestIdx + 1) << 8) | bestByte
        if (firstRef < 0 || ref < firstRef) {
          firstRef = ref
        }
        if (ref > lastRef) {
          lastRef = ref
        }
      }
    })
    m = end
  }
  if (firstRef < 0) {
    return
  }
  for (let ref = firstRef; ref <= lastRef; ref++) {
    const packed = best[ref]!
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
      prob,
    })
  }
}

// ---------------------------------------------------------------------------
// ARM 3: control — a second, separately-declared copy of ARM 1.

function walkControl(
  cigarOps: ArrayLike<number>,
  positions: number[],
  callback: (ref: number, idx: number) => void,
) {
  let readPos = 0
  let refPos = 0
  let currPos = 0
  for (
    let i = 0, l = cigarOps.length, l2 = positions.length;
    i < l && currPos < l2;
    i++
  ) {
    const packed = cigarOps[i]!
    const len = packed >>> 4
    const op = packed & 0xf
    if (op === 4 || op === 1) {
      for (let j = 0; j < len && currPos < l2; j++) {
        if (positions[currPos] === readPos + j) {
          currPos++
        }
      }
      readPos += len
    } else if (op === 2 || op === 3) {
      refPos += len
    } else if (op === 0 || op === 8 || op === 7) {
      for (let j = 0; j < len && currPos < l2; j++) {
        if (positions[currPos] === readPos + j) {
          callback(refPos + j, currPos)
          currPos++
        }
      }
      readPos += len
      refPos += len
    }
  }
}

function runControl(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = getModPositions(r.mm, r.seq, r.strand)
    emitControl(r, mods, entries)
  }
  return entries
}

function emitControl(r: Read, mods: ModWithPositions[], entries: Entry[]) {
  const isRev = r.strand === -1
  const ml = r.ml
  const nMods = mods.length
  if (nMods === 0) {
    return
  }
  let span = 0
  for (let i = 0, l = r.ops.length; i < l; i++) {
    const packed = r.ops[i]!
    const op = packed & 0xf
    if (op === 2 || op === 3 || op === 0 || op === 7 || op === 8) {
      span += packed >>> 4
    }
  }
  const best = new Uint16Array(span + 1)
  let firstRef = -1
  let lastRef = -1
  for (let m = 0; m < nMods;) {
    const mod = mods[m]!
    const positions = mod.positions
    let end = m + 1
    while (end < nMods && mods[end]!.positions === positions) {
      end++
    }
    const posLen = positions.length
    const groupStart = m
    const groupEnd = end
    walkControl(r.ops, positions, (ref, idx) => {
      const mmOrder = isRev ? posLen - 1 - idx : idx
      let bestByte = -1
      let bestIdx = groupStart
      for (let k = groupStart; k < groupEnd; k++) {
        const g = mods[k]!
        const byte = ml[g.probStart + mmOrder * g.probStride] ?? 0
        if (byte > bestByte) {
          bestByte = byte
          bestIdx = k
        }
      }
      const prev = best[ref]!
      if (prev === 0 || (prev & 0xff) < bestByte) {
        best[ref] = ((bestIdx + 1) << 8) | bestByte
        if (firstRef < 0 || ref < firstRef) {
          firstRef = ref
        }
        if (ref > lastRef) {
          lastRef = ref
        }
      }
    })
    m = end
  }
  if (firstRef < 0) {
    return
  }
  for (let ref = firstRef; ref <= lastRef; ref++) {
    const packed = best[ref]!
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
      prob,
    })
  }
}

// ---------------------------------------------------------------------------

// A CIGAR holding the same READ LENGTH in `nOps` ops. Alternates M with a
// one-base D so the op count is what varies and the read coordinate space stays
// exactly as long — the positions are real and must keep landing in it. The last
// M absorbs the remainder, so read length is exact rather than approximate.
function synthCigar(readLen: number, nOps: number) {
  if (nOps <= 1) {
    return new Uint32Array([(readLen << 4) | 0])
  }
  const nM = Math.ceil(nOps / 2)
  const chunk = Math.max(1, Math.floor(readLen / nM))
  const out: number[] = []
  let used = 0
  for (let i = 0; i < nM; i++) {
    const isLast = i === nM - 1
    const len = isLast ? readLen - used : Math.min(chunk, readLen - used)
    if (len <= 0) {
      break
    }
    out.push((len << 4) | 0)
    used += len
    if (!isLast && used < readLen) {
      out.push((1 << 4) | 2)
    }
  }
  return Uint32Array.from(out)
}

function serialize(out: Entry[]) {
  const lines: string[] = []
  for (const e of out) {
    lines.push(
      `${e.readIndex} ${e.position} ${e.modType} ${e.base} ${e.prob.toFixed(6)}`,
    )
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
  const path = join(BAM, '200x.longread.mod.bam')
  try {
    readFileSync(path, { flag: 'r' })
  } catch {
    console.log(`not present at ${path}, nothing to measure`)
    return
  }
  const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  const real = toReads(records)
  if (real.length === 0) {
    console.log('no MM/ML reads in range')
    return
  }
  const reads =
    OPS === 'real'
      ? real
      : real.map(r => ({ ...r, ops: synthCigar(r.seq.length, Number(OPS)) }))

  let totalOps = 0
  let totalBases = 0
  for (const r of reads) {
    totalOps += r.ops.length
    totalBases += r.seq.length
  }

  const outBase = serialize(runPerBase(reads))
  const outPos = serialize(runPerPosition(reads))
  const outControl = serialize(runControl(reads))

  const diffPos = firstDifference(outBase, outPos)
  const diffControl = firstDifference(outBase, outControl)
  if (diffControl) {
    throw new Error(
      `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
    )
  }

  const best = { base: Infinity, pos: Infinity, ctl: Infinity }
  const sides = [
    { k: 'base' as const, run: () => runPerBase(reads) },
    { k: 'pos' as const, run: () => runPerPosition(reads) },
    { k: 'ctl' as const, run: () => runControl(reads) },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }
  const x = (v: number) => `${(best.base / v).toFixed(3)}x`
  console.log(
    `cigar op density: per base vs per position\n` +
      `200x.longread.mod.bam ${REFNAME}:${START}-${END}, ` +
      `min of ${ROUNDS} rotated rounds, --ops=${OPS}\n` +
      `  ${reads.length} MM reads, ${outBase.length} marks emitted\n` +
      `  ${(totalOps / 1e3).toFixed(1)}k ops over ${(totalBases / 1e6).toFixed(1)}M read bases ` +
      `= ${(totalOps / reads.length).toFixed(0)} ops/read, one every ` +
      `${(totalBases / totalOps).toFixed(1)} bases\n\n` +
      `  per base      ${best.base.toFixed(1).padStart(8)} ms\n` +
      `  per position  ${best.pos.toFixed(1).padStart(8)} ms   ${x(best.pos)}   ` +
      `output ${diffPos ? `DIFFERS — ${diffPos}` : 'identical'}\n` +
      `  control       ${best.ctl.toFixed(1).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
  )
}

await main()
