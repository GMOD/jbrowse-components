// `getNextRefPos` walks every read BASE. It could walk every POSITION.
//
//   node --expose-gc plugins/alignments/benches/cigarWalkShape.bench.ts --tag=m
//   node --expose-gc plugins/alignments/benches/cigarWalkShape.bench.ts --tag=mh
//
// Flags: --rounds=<n> (default 30), --bam=<dir>, --refName, --start, --end,
// --tag=<m|mh>
//
// The harness rules (interleave, min-of-rounds, a byte-identical control, an
// identity check before any timing is believed) are in
// agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. `getNextRefPos` maps read offsets to reference offsets like
// this:
//
//     for each cigar op:
//       for each base j in the op:
//         if (positions[currPos] === readPos + j) { emit; currPos++ }
//
// so it is **O(read length)**, and the thing it is looking for is O(positions).
// `modPhases.bench.ts` measures this walk at 45-46% of the whole per-read
// modification pipeline on the full extent of `200x.longread.mod.bam`, where the
// ratio it is paying is **43.7 Mbp of read sequence scanned to find 0.84M
// calls, 52 bases visited per call found**.
//
// Read positions are ascending and cigar ops are ascending, so the loop can be
// turned inside out: hold a cursor into the ops, and for each position advance
// the cursor to the op containing it and compute `refPos + (position - readPos)`
// directly. That is O(positions + ops), and it visits each op once whether the
// op is 4 bases long or 40,000.
//
// This is a `@jbrowse/cigar-utils` change if it pays, so it is measured against
// the real consumers rather than in isolation: both arms run the WHOLE per-read
// pipeline (MM parse, walk, winner selection, emit), which is what makes the
// ratio here comparable to modPhases' phase split.
//
// **THE WINDOW IS THE WHOLE CONTIG ON PURPOSE** — see the same note in
// modPhases.bench.ts. A 19 kb window prices arithmetic on a cache-resident
// working set; this ratio is about how much memory the walk touches, so it has
// to be measured where there is memory to touch.
//
// THREE ARMS. Both walks are declared HERE rather than imported, so this keeps
// measuring the comparison after one of them lands — which one has, so read
// `perPosition` as "what ships" and `perBase` as "what it replaced":
//   perBase     — the per-base loop
//   perPosition — the cursor walk. Shipped
//   control     — a second, separately-declared copy of `perBase`
//
// EQUIVALENCE, since the two are not obviously the same function. Read
// coordinates are covered contiguously by the S/I/M/X/= ops (D and N consume no
// read), so every position falls in exactly one of them, and ascending positions
// are therefore consumed in op order. Given that, `positions[currPos] < readEnd`
// selects exactly the positions the per-base loop would have matched.
//
// The one case where they genuinely differ is **duplicate positions**: the
// per-base loop consumes at most one per base offset, so a repeat is never
// consumed and silently blocks every position after it, while the cursor walk
// emits both. `getModPositions` cannot produce a duplicate (its inner do-while
// advances `currPos` at least once per entry, so positions strictly increase),
// and the cursor walk's answer is the better one anyway — but it is a difference,
// and a caller outside this repo could hit it.
//
// WHAT IT SAYS, on the full extent of `200x.longread.mod.bam` (883 MM reads,
// 43.7 Mbp, 0.84M calls), `--rounds=30`, 2026-08-14 at load 1.9-6:
//
//   tag     per base   per position            control   marks
//   C+m     574.9 ms   490.7 ms      1.171x    0.984     528,822
//   C+mh    548.2 ms   480.2 ms      1.142x    1.001     755,151
//
// Output identical on both. That is 1.17x on the WHOLE per-read pipeline, of
// which `modPhases.bench.ts` measures this walk at 45%.
//
// **The iteration count falls much further than the time does, and the reason is
// the fixture rather than the change.** These reads carry 6.25M cigar ops
// between them — 7,081 per read, an op every 7 bases — so the cursor walk still
// pays 6.25M op iterations plus 0.84M position iterations against the per-base
// walk's 43.7M. A 6x cut in iterations, not 52x, and per-op work is heavier than
// per-base work. Quoting "52 bases per call" as if it were the speedup would be
// wrong.
//
// This header used to argue from there that 1.17x was near a FLOOR — that the op
// term caps it, and a technology with fewer ops (PacBio HiFi, which is what
// Fiber-seq is) would show much more. **That was reasoning, and it was wrong.**
// `cigarOpDensity.bench.ts` synthesizes the op density directly, holding the
// reads, tags and positions fixed, and the ratio is flat across a 5,000x range:
// 1.179x at one op per read, 1.127x at the real 7,081. At one op per read the
// iteration difference is 52x — the theoretical maximum for this change — and it
// buys 1.18x.
//
// The reason is that the walk phase is **per-call bound, not scan bound**: both
// shapes invoke the callback 0.84M times and do identical work inside it, so the
// scan is the minority of what they cost. Read 1.17x as this change's value, full
// stop, and see that bench before predicting more from a different fixture.
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
// ARM 1: perBase — the shipped walk.

function modPositions1(mm: string, fseq: string, fstrand: number) {
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
    const mods = modPositions1(r.mm, r.seq, r.strand)
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
        walkPerBase(r.ops, positions, (ref, idx) => {
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
// ARM 2: perPosition — the cursor walk.

function modPositions2(mm: string, fseq: string, fstrand: number) {
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

// One pass over the OPS, and inside each op one pass over the positions that
// land in it. Every position is visited once and every op once; no loop runs
// over the bases an op spans.
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
      // ref - read is constant across the op, so the mapping is one add
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
    const mods = modPositions2(r.mm, r.seq, r.strand)
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
        walkPerPosition(r.ops, positions, (ref, idx) => {
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

function modPositions3(mm: string, fseq: string, fstrand: number) {
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
    const mods = modPositions3(r.mm, r.seq, r.strand)
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

// How lopsided the walk actually is on this fixture, printed beside the ratio so
// the number has its cause next to it.
function walkRatio(reads: Read[]) {
  let bases = 0
  let ops = 0
  let positions = 0
  for (const r of reads) {
    ops += r.ops.length
    for (let i = 0, l = r.ops.length; i < l; i++) {
      const packed = r.ops[i]!
      const op = packed & 0xf
      if (op === 4 || op === 1 || op === 0 || op === 8 || op === 7) {
        bases += packed >>> 4
      }
    }
    const mods = modPositions1(r.mm, r.seq, r.strand)
    const seen = new Set<number[]>()
    for (const m of mods) {
      if (!seen.has(m.positions)) {
        seen.add(m.positions)
        positions += m.positions.length
      }
    }
  }
  return { bases, ops, positions }
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
  const shape = walkRatio(reads)

  const outPerBase = serialize(runPerBase(reads))
  const outPerPosition = serialize(runPerPosition(reads))
  const outControl = serialize(runControl(reads))

  const diffPerPosition = firstDifference(outPerBase, outPerPosition)
  const diffControl = firstDifference(outPerBase, outControl)
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
    `cigar walk shape: per base vs per position, C+${TAG}\n` +
      `200x.longread.mod.bam ${REFNAME}:${START}-${END}, ` +
      `min of ${ROUNDS} rotated rounds\n` +
      `  ${reads.length} MM reads, ${outPerBase.length} marks emitted\n` +
      `  the walk's own shape: ${(shape.bases / 1e6).toFixed(1)}M read bases, ` +
      `${(shape.ops / 1e3).toFixed(1)}k cigar ops, ` +
      `${(shape.positions / 1e6).toFixed(2)}M positions ` +
      `-> ${(shape.bases / shape.positions).toFixed(0)} bases visited per position found\n\n` +
      `  per base      ${best.base.toFixed(1).padStart(8)} ms   <- ships\n` +
      `  per position  ${best.pos.toFixed(1).padStart(8)} ms   ${x(best.pos)}   ` +
      `output ${diffPerPosition ? `DIFFERS — ${diffPerPosition}` : 'identical'}\n` +
      `  control       ${best.ctl.toFixed(1).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
  )
}

await main()
