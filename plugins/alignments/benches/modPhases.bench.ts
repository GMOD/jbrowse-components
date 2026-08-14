// Where the per-read modification time goes at scale, phase by phase.
//
//   node --expose-gc plugins/alignments/benches/modPhases.bench.ts --tag=m
//   node --expose-gc plugins/alignments/benches/modPhases.bench.ts --tag=mh
//
// Flags: --rounds=<n> (default 30), --bam=<dir>, --refName, --start, --end,
// --tag=<m|mh>
//
// The harness rules (interleave, min-of-rounds, a control, an identity check
// before any timing is believed) are in agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION, and why it comes before any more variants. Three optimizations
// have landed on this path and each was aimed at a shape someone recognized —
// the sparse array of objects, the boxed probabilities, the per-type walk. That
// works until it doesn't: the next candidate list (positions in a typed array,
// fusing the delta walk into the CIGAR walk, reusing a scratch buffer) is three
// guesses about the same phase, and nothing here says that phase is the one
// that costs. So measure the phases first and aim afterwards.
//
// **THE WINDOW IS THE WHOLE CONTIG ON PURPOSE.** Every earlier bench on this
// path used `chr22_mask:124000-143000` — 285 reads, 14 Mbp of sequence, 0.24M
// calls — which is small enough to sit in cache, so it prices arithmetic and
// says nothing about allocation rate or residency. `chr22_mask:1-400000` is the
// file's full extent: 883 reads, 43.7 Mbp, 0.84M calls, ~3.1x. That is the
// largest modBAM in either corpus, and `--start`/`--end` still narrow it for
// anyone who wants the old regime back to compare.
//
// FOUR ARMS, cumulative, so each row is what that phase ADDED:
//   parse       — the MM split and the delta walk against the read sequence,
//                 producing the positions arrays and nothing else
//   +walk       — plus the CIGAR walk and the per-refpos winner selection
//   +emit       — plus the threshold test and the per-mark entry. This arm is
//                 the whole shipped pipeline
//   control     — a second, separately-declared copy of `+emit`
//
// The arms produce DIFFERENT outputs by construction, so only `+emit` and
// `control` can be compared for identity; `parse` and `+walk` instead return a
// checksum over what they built, which is printed, so an arm that quietly
// skipped its work shows up as a zero rather than as a fast row.
//
// WHAT IT SAYS, on the full extent of `200x.longread.mod.bam` (883 MM reads,
// 43.7 Mbp), `--rounds=30`, 2026-08-14 at load 1.7-2.9:
//
//   tag     parse   walk   emit   pipeline   control
//   C+m      47%     45%     9%    518.5 ms   0.995
//   C+mh     45%     46%    10%    543.1 ms   1.026
//
// **Two phases of equal size and a third that is noise.** That is the whole
// output of this bench and it redirected the two candidates that came after it:
//
// - the walk is 45%, and it was O(read length) looking for something O(positions)
//   in size. `cigarWalkShape.bench.ts` took that and got 1.17x on the pipeline.
// - parse is 46%, and the obvious suspect inside it — `split(',')` building 0.84M
//   throwaway substrings — turns out to be about a tenth of it
//   (`mmParseShape.bench.ts`, 1.056x). The rest is the delta walk's charCodeAt
//   loop over 43.7 Mbp, which `seqscan.probe.ts` prices separately.
// - emit is 10%, so the columnar-output idea that `modExtract.bench.ts` already
//   measured as a REGRESSION had a ceiling of 10% even had it worked. Worth
//   knowing before anyone proposes it a third time.
//
// Written out longhand, four times. Do NOT refactor the arms into one driver
// parameterized by a phase count — a shared driver makes the call site
// polymorphic and hands every arm one set of inline caches, which has scored a
// byte-identical control at 1.14x in this repo's sibling benches.
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
// One tag per process — the two tags are two fixtures as far as V8 is
// concerned. BENCHMARKING.md's dataset-contamination entry.
const TAG = arg('tag', 'mh')
// Which modBAM. The corpus default is single-group ONT-ish; the Fiber-seq slice
// is the only multi-group file here (`HG002_WGS_fiberseq.MAGEL2.bam`, chr15).
const FILE = arg('file', '200x.longread.mod.bam')

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
// ARM 1: parse — the MM split and the delta walk, and nothing after it.

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

// Sum every position built, so the walk cannot be optimized away and an arm
// that skipped it prints a different number.
function runParse(reads: Read[]) {
  let checksum = 0
  for (const r of reads) {
    const mods = modPositions1(r.mm, r.seq, r.strand)
    for (let m = 0; m < mods.length; m++) {
      const p = mods[m]!.positions
      for (let i = 0, l = p.length; i < l; i++) {
        checksum += p[i]!
      }
    }
  }
  return checksum
}

// ---------------------------------------------------------------------------
// ARM 2: +walk — plus the CIGAR walk and the winner selection, no emit.

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

function nextRefPos2(
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

function runWalk(reads: Read[]) {
  let checksum = 0
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
        nextRefPos2(r.ops, positions, (ref, idx) => {
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
        nextRefPos2(r.ops, positions, (ref, idx) => {
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
      checksum += best[ref]!
    }
  }
  return checksum
}

// ---------------------------------------------------------------------------
// ARM 3: +emit — plus the threshold and the per-mark entry. The whole pipeline.

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

function nextRefPos3(
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

function runEmit(reads: Read[]) {
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
        nextRefPos3(r.ops, positions, (ref, idx) => {
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
        nextRefPos3(r.ops, positions, (ref, idx) => {
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
// ARM 4: control — a second, separately-declared copy of ARM 3.

function modPositions4(mm: string, fseq: string, fstrand: number) {
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

function nextRefPos4(
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
    const mods = modPositions4(r.mm, r.seq, r.strand)
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
        nextRefPos4(r.ops, positions, (ref, idx) => {
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
        nextRefPos4(r.ops, positions, (ref, idx) => {
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

// `C+m?` -> `C+mh?`, positions untouched, ML interleaved to two bytes per
// position. See modCombinedCode.bench.ts for why the fixture has to be doctored.
function toCombined(reads: Read[]) {
  let rewritten = 0
  const out = reads.map(r => {
    const groups = r.mm.split(';').filter(Boolean)
    if (groups.length !== 1 || !groups[0]!.startsWith('C+m')) {
      return r
    }
    const split = groups[0]!.split(',')
    const header = parseModHeader(split[0]!, groups[0]!)
    if (header.typestr !== 'm' || split.length - 1 !== r.ml.length) {
      return r
    }
    rewritten++
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
  return { reads: out, rewritten }
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const path = join(BAM, FILE)
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
  const reads = TAG === 'mh' ? toCombined(single).reads : single

  const bp = reads.reduce((a, r) => a + r.seq.length, 0)
  const calls = reads.reduce((a, r) => a + r.ml.length, 0)

  // Warm every arm identically before timing — an arm that skipped this would
  // enter the loop with a monomorphic call site while the others had gone
  // polymorphic, which has scored a fake 0.61x control in this repo.
  const sumParse = runParse(reads)
  const sumWalk = runWalk(reads)
  const outEmit = serialize(runEmit(reads))
  const outControl = serialize(runControl(reads))

  const diffControl = firstDifference(outEmit, outControl)
  if (diffControl) {
    throw new Error(
      `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
    )
  }

  const best = {
    parse: Infinity,
    walk: Infinity,
    emit: Infinity,
    ctl: Infinity,
  }
  const sides = [
    { k: 'parse' as const, run: () => runParse(reads) },
    { k: 'walk' as const, run: () => runWalk(reads) },
    { k: 'emit' as const, run: () => runEmit(reads) },
    { k: 'ctl' as const, run: () => runControl(reads) },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }

  const pct = (v: number) => `${((100 * v) / best.emit).toFixed(0)}%`
  console.log(
    `where the modification time goes, C+${TAG}\n` +
      `${FILE} ${REFNAME}:${START}-${END}, ` +
      `min of ${ROUNDS} rotated rounds\n` +
      `  ${reads.length} MM reads, ${(bp / 1e6).toFixed(1)} Mbp of sequence, ` +
      `${(calls / 1e6).toFixed(2)}M calls, ${outEmit.length} marks emitted\n\n` +
      `  parse         ${best.parse.toFixed(1).padStart(8)} ms   ${pct(best.parse).padStart(4)} of the pipeline` +
      `   checksum ${sumParse}\n` +
      `  +walk         ${best.walk.toFixed(1).padStart(8)} ms   ${pct(best.walk).padStart(4)}` +
      `                  checksum ${sumWalk}\n` +
      `  +emit         ${best.emit.toFixed(1).padStart(8)} ms   ${pct(best.emit).padStart(4)}   <- the shipped pipeline\n` +
      `  control       ${best.ctl.toFixed(1).padStart(8)} ms   ` +
      `${(best.emit / best.ctl).toFixed(3)}x vs +emit   <- noise floor\n\n` +
      `  so: parse ${pct(best.parse)}, ` +
      `walk ${pct(best.walk - best.parse)}, ` +
      `emit ${pct(best.emit - best.walk)}\n`,
  )
}

await main()
