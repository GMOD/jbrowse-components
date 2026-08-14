// The MM delta list is parsed by `split(',')`. It could be scanned.
//
//   node --expose-gc plugins/alignments/benches/mmParseShape.bench.ts --tag=m
//   node --expose-gc plugins/alignments/benches/mmParseShape.bench.ts --tag=mh
//
// Flags: --rounds=<n> (default 30), --bam=<dir>, --refName, --start, --end,
// --tag=<m|mh>
//
// The harness rules (interleave, min-of-rounds, a byte-identical control, an
// identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. `getModPositions` opens each MM group with
// `const split = group.split(',')`, then reads `+split[i]` in the delta loop. A
// nanopore read here declares ~950 calls, so that is ~950 substring allocations
// per read to produce ~950 numbers that are used once each and thrown away — on
// this fixture, **0.84M substrings**. `modPhases.bench.ts` measures the parse
// phase (this split, the delta walk over the read sequence, and the array build)
// at 46-47% of the whole per-read pipeline, so it is worth knowing which of the
// three it is.
//
// The alternative reads the digits straight out of the group string, so no
// substring exists at all. It needs the position COUNT up front for the
// reverse-strand pre-allocation, which the split form got from `split.length` —
// one comma-counting scan of a ~3 kB string, against ~950 allocations.
//
// **THE WINDOW IS THE WHOLE CONTIG ON PURPOSE** — see the same note in
// modPhases.bench.ts. Allocation rate is exactly the thing a 19 kb window cannot
// show.
//
// THREE ARMS, each running the WHOLE per-read pipeline so the ratio is
// comparable with the sibling benches:
//   split       — what ships
//   scan        — the digit scan, no substrings
//   control     — a second, separately-declared copy of `split`
//
// WHERE THEY DIFFER, since it is not nothing: `+split[i]` accepts surrounding
// whitespace, a sign, and a float, and yields NaN on anything else — which the
// `delta >= 0` loop then treats as a terminated walk. The scan accumulates
// decimal digits only and reads a malformed field as if the non-digits were
// absent. Both are wrong on a malformed tag, differently. SAMtags says these are
// unsigned integers, and `getModPositions.test.ts` covers only well-formed ones.
//
// WHAT IT SAYS, on the full extent of `200x.longread.mod.bam` (883 MM reads,
// 2.0M chars of MM tag, 0.84M deltas — 953 substrings per read), `--rounds=30`,
// 2026-08-14 at load 1.9-4:
//
//   tag     split      scan                control
//   C+m     443.2 ms   419.6 ms   1.056x   0.995
//   C+mh    500.2 ms   460.9 ms   1.085x   1.006
//
// Output identical. **Not adopted**, and the number is why rather than the risk:
// 5-8% for a hand-rolled integer parser that reads a malformed tag differently
// from `+`, on a path where `modPhases.bench.ts` puts the whole parse phase at
// 46%. Removing 0.84M substring allocations is worth about a twentieth of the
// pipeline.
//
// **The negative result is the useful part**, because it says where the parse
// phase's time actually is: not the split, but the delta walk's charCodeAt loop
// stepping through 43.7 Mbp of read sequence one base at a time.
// `seqscan.probe.ts` prices replacing that with `indexOf` jumps at 1.42x on the
// walk alone. That is the candidate this bench points at; this one is kept as
// the measurement that redirected it.
//
// Written out longhand, three times, deliberately.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { isSingleModType, parseModHeader } from '@jbrowse/modifications-utils'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '30'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '1'))
const END = Number(arg('end', '400000'))
const TAG = arg('tag', 'm')

const THRESHOLD = 0.5
const COMMA = 44
const ZERO = 48

const COMPLEMENT_CODE: Record<number, number> = {
  65: 84,
  84: 65,
  67: 71,
  71: 67,
  78: 78,
}

interface Read {
  index: number
  start: number
  strand: -1 | 0 | 1
  seq: string
  mm: string
  ml: ArrayLike<number>
  ops: Uint32Array | number[]
}

interface Mod {
  type: string
  base: string
  positions: number[]
  probStart: number
  probStride: number
}

interface Entry {
  readIndex: number
  position: number
  base: string
  modType: string
  prob: number
}

// ---------------------------------------------------------------------------
// ARM 1: split — what ships.

function modPositionsSplit(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const { base, typestr } = parseModHeader(split[0]!, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const baseCode = base.charCodeAt(0)
    const targetCode = isRev
      ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
      : baseCode
    const isN = base === 'N'
    const positions: number[] = isRev ? new Array(nPositions) : []
    let writeIndex = isRev ? nPositions - 1 : 0
    let currPos = 0

    for (let i = 1; i < splitLength; i++) {
      let delta = +split[i]!
      do {
        const seqCode = isRev
          ? fseq.charCodeAt(seqLength - 1 - currPos)
          : fseq.charCodeAt(currPos)
        if (isN || seqCode === targetCode) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < seqLength)
      if (isRev) {
        positions[writeIndex--] = seqLength - currPos
      } else {
        positions[writeIndex++] = currPos - 1
      }
    }

    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
          positions,
          probStart: mlBase + j,
          probStride: nTypes,
        })
      }
    }
    mlBase += nPositions * nTypes
  }
  return result
}

function walkSplit(
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

function runSplit(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = modPositionsSplit(r.mm, r.seq, r.strand)
    const isRev = r.strand === -1
    const ml = r.ml
    const nMods = mods.length
    if (nMods === 0) {
      continue
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
      if (end - m === 1) {
        const { probStart, probStride } = mod
        const tag = (m + 1) << 8
        walkSplit(r.ops, positions, (ref, idx) => {
          const mmOrder = isRev ? posLen - 1 - idx : idx
          const byte = ml[probStart + mmOrder * probStride] ?? 0
          const prev = best[ref]!
          if (prev === 0 || (prev & 0xff) < byte) {
            best[ref] = tag | byte
            if (firstRef < 0 || ref < firstRef) {
              firstRef = ref
            }
            if (ref > lastRef) {
              lastRef = ref
            }
          }
        })
      } else {
        const groupStart = m
        const groupEnd = end
        walkSplit(r.ops, positions, (ref, idx) => {
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
      }
      m = end
    }
    if (firstRef < 0) {
      continue
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
  return entries
}

// ---------------------------------------------------------------------------
// ARM 2: scan — the digit scan.

function modPositionsScan(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const groupLen = group.length
    const firstComma = group.indexOf(',')
    // The header is one small substring either way; it is the DELTA list this
    // arm is about.
    const header = firstComma === -1 ? group : group.slice(0, firstComma)
    const { base, typestr } = parseModHeader(header, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length

    // The count the split form got from `split.length`. One scan of a few kB,
    // against one allocation per delta.
    let nPositions = 0
    if (firstComma !== -1) {
      for (let p = firstComma; p < groupLen; p++) {
        if (group.charCodeAt(p) === COMMA) {
          nPositions++
        }
      }
    }

    const baseCode = base.charCodeAt(0)
    const targetCode = isRev
      ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
      : baseCode
    const isN = base === 'N'
    const positions: number[] = isRev ? new Array(nPositions) : []
    let writeIndex = isRev ? nPositions - 1 : 0
    let currPos = 0

    let p = firstComma + 1
    for (let n = 0; n < nPositions; n++) {
      let delta = 0
      for (let c = 0; p < groupLen; p++) {
        c = group.charCodeAt(p)
        if (c === COMMA) {
          break
        }
        delta = delta * 10 + (c - ZERO)
      }
      p++
      do {
        const seqCode = isRev
          ? fseq.charCodeAt(seqLength - 1 - currPos)
          : fseq.charCodeAt(currPos)
        if (isN || seqCode === targetCode) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < seqLength)
      if (isRev) {
        positions[writeIndex--] = seqLength - currPos
      } else {
        positions[writeIndex++] = currPos - 1
      }
    }

    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
          positions,
          probStart: mlBase + j,
          probStride: nTypes,
        })
      }
    }
    mlBase += nPositions * nTypes
  }
  return result
}

function walkScan(
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

function runScan(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = modPositionsScan(r.mm, r.seq, r.strand)
    const isRev = r.strand === -1
    const ml = r.ml
    const nMods = mods.length
    if (nMods === 0) {
      continue
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
      if (end - m === 1) {
        const { probStart, probStride } = mod
        const tag = (m + 1) << 8
        walkScan(r.ops, positions, (ref, idx) => {
          const mmOrder = isRev ? posLen - 1 - idx : idx
          const byte = ml[probStart + mmOrder * probStride] ?? 0
          const prev = best[ref]!
          if (prev === 0 || (prev & 0xff) < byte) {
            best[ref] = tag | byte
            if (firstRef < 0 || ref < firstRef) {
              firstRef = ref
            }
            if (ref > lastRef) {
              lastRef = ref
            }
          }
        })
      } else {
        const groupStart = m
        const groupEnd = end
        walkScan(r.ops, positions, (ref, idx) => {
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
      }
      m = end
    }
    if (firstRef < 0) {
      continue
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
  return entries
}

// ---------------------------------------------------------------------------
// ARM 3: control — a second, separately-declared copy of ARM 1.

function modPositionsControl(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const { base, typestr } = parseModHeader(split[0]!, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const baseCode = base.charCodeAt(0)
    const targetCode = isRev
      ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
      : baseCode
    const isN = base === 'N'
    const positions: number[] = isRev ? new Array(nPositions) : []
    let writeIndex = isRev ? nPositions - 1 : 0
    let currPos = 0

    for (let i = 1; i < splitLength; i++) {
      let delta = +split[i]!
      do {
        const seqCode = isRev
          ? fseq.charCodeAt(seqLength - 1 - currPos)
          : fseq.charCodeAt(currPos)
        if (isN || seqCode === targetCode) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < seqLength)
      if (isRev) {
        positions[writeIndex--] = seqLength - currPos
      } else {
        positions[writeIndex++] = currPos - 1
      }
    }

    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        positions,
        probStart: mlBase,
        probStride: 1,
      })
    } else {
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
          positions,
          probStart: mlBase + j,
          probStride: nTypes,
        })
      }
    }
    mlBase += nPositions * nTypes
  }
  return result
}

function walkControl(
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

function runControl(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    const mods = modPositionsControl(r.mm, r.seq, r.strand)
    const isRev = r.strand === -1
    const ml = r.ml
    const nMods = mods.length
    if (nMods === 0) {
      continue
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
      if (end - m === 1) {
        const { probStart, probStride } = mod
        const tag = (m + 1) << 8
        walkControl(r.ops, positions, (ref, idx) => {
          const mmOrder = isRev ? posLen - 1 - idx : idx
          const byte = ml[probStart + mmOrder * probStride] ?? 0
          const prev = best[ref]!
          if (prev === 0 || (prev & 0xff) < byte) {
            best[ref] = tag | byte
            if (firstRef < 0 || ref < firstRef) {
              firstRef = ref
            }
            if (ref > lastRef) {
              lastRef = ref
            }
          }
        })
      } else {
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
      }
      m = end
    }
    if (firstRef < 0) {
      continue
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
  return entries
}

// ---------------------------------------------------------------------------

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

function toCombined(reads: Read[]) {
  return reads.map(r => {
    const groups = r.mm.split(';').filter(Boolean)
    if (groups.length !== 1 || !groups[0]!.startsWith('C+m')) {
      return r
    }
    const split = groups[0]!.split(',')
    const header = parseModHeader(split[0]!, groups[0]!)
    if (header.typestr !== 'm' || split.length - 1 !== r.ml.length) {
      return r
    }
    const n = r.ml.length
    const ml = new Uint8Array(n * 2)
    for (let i = 0; i < n; i++) {
      const m = r.ml[i]!
      ml[i * 2] = m
      ml[i * 2 + 1] = 255 - m
    }
    return {
      ...r,
      mm: `C+mh${header.mod === '.' ? '' : header.mod},${split.slice(1).join(',')};`,
      ml,
    }
  })
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
  const single = toReads(records)
  if (single.length === 0) {
    console.log('no MM/ML reads in range')
    return
  }
  const reads = TAG === 'mh' ? toCombined(single) : single

  let mmChars = 0
  let deltas = 0
  for (const r of reads) {
    mmChars += r.mm.length
    for (let i = 0; i < r.mm.length; i++) {
      if (r.mm.charCodeAt(i) === COMMA) {
        deltas++
      }
    }
  }

  const outSplit = serialize(runSplit(reads))
  const outScan = serialize(runScan(reads))
  const outControl = serialize(runControl(reads))

  const diffScan = firstDifference(outSplit, outScan)
  const diffControl = firstDifference(outSplit, outControl)
  if (diffControl) {
    throw new Error(
      `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
    )
  }

  const best = { split: Infinity, scan: Infinity, ctl: Infinity }
  const sides = [
    { k: 'split' as const, run: () => runSplit(reads) },
    { k: 'scan' as const, run: () => runScan(reads) },
    { k: 'ctl' as const, run: () => runControl(reads) },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }
  const x = (v: number) => `${(best.split / v).toFixed(3)}x`
  console.log(
    `MM delta parse: split vs scan, C+${TAG}\n` +
      `200x.longread.mod.bam ${REFNAME}:${START}-${END}, ` +
      `min of ${ROUNDS} rotated rounds\n` +
      `  ${reads.length} MM reads, ${outSplit.length} marks emitted\n` +
      `  ${(mmChars / 1e6).toFixed(1)}M chars of MM tag, ` +
      `${(deltas / 1e6).toFixed(2)}M deltas ` +
      `-> ${(deltas / reads.length).toFixed(0)} substrings per read that the scan does not build\n\n` +
      `  split         ${best.split.toFixed(1).padStart(8)} ms   <- ships\n` +
      `  scan          ${best.scan.toFixed(1).padStart(8)} ms   ${x(best.scan)}   ` +
      `output ${diffScan ? `DIFFERS — ${diffScan}` : 'identical'}\n` +
      `  control       ${best.ctl.toFixed(1).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
  )
}

await main()
