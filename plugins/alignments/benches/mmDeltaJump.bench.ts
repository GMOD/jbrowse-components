// The delta walk steps one base at a time. `indexOf` is a native scan.
//
//   node --expose-gc plugins/alignments/benches/mmDeltaJump.bench.ts
//   node --expose-gc plugins/alignments/benches/mmDeltaJump.bench.ts --strand=rev
//   node --expose-gc plugins/alignments/benches/mmDeltaJump.bench.ts \
//     --file=200x.longread.mod.bam --refName=chr22_mask --start=1 --end=400000
//
// Flags: --rounds=<n> (default 20), --bam=<dir>, --file, --refName, --start,
// --end, --strand=fwd|rev|both (default both), --overrun
//
// The harness rules are in agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. `getModPositions` finds each call by stepping one base at a time
// until it has counted past `delta` occurrences of the modified base.
// `String.prototype.indexOf` for a single character is a native scan, so the same
// walk is `delta + 1` jumps instead of `distance` steps.
// `seqscan.probe.ts` measures that at 1.42x in isolation — forward strand, one
// group, no control, and no positions arrays actually built. This is the bench
// version: real `getModPositions` output, both strands, a control, and the CIGAR
// walk and emit downstream so the ratio can be read against the whole pipeline.
//
// **WHY IT IS WORTH DOING NOW.** It used to be blocked on "this competes with the
// one-pass shape rather than composing with it" — htslib keeps a per-base scan
// because one pass has to count several canonical bases at once and a
// single-character search cannot. `multiGroupParse.bench.ts` has since measured
// one pass as a LOSS below three distinct groups, and real dorado output is two,
// so on this data there is no one-pass shape for jumping to be an alternative to.
//
// **THE TWO REGIMES, and they are far apart.** What decides this is the distance
// between calls, not the read length:
//
//   ont.6ma.chr20        ~2,310 calls per 8.1 kb read — a call every ~3.5 bases
//   200x.longread.mod      ~950 calls per 49 kb read  — a call every ~52 bases
//
// So the single-group fixture jumps ~12 times where it would have stepped ~52,
// and the ONT fixture jumps ~2 times where it would have stepped ~9. Both are run
// below. A native scan has per-CALL overhead, so the dense fixture is where this
// can invert, and it is also the one that matters most.
//
// FOUR ARMS:
//   step    — the previous shape: charCodeAt one base at a time
//   jump    — indexOf forward, lastIndexOf reverse. The obvious version
//   hybrid  — indexOf forward, step reverse. What ships
//   control — a second, separately-declared copy of `step`
//
// All of them carry the same-base merge, because it ships. The arms are all
// hand-copies, so agreeing with each other only proves the copies match — the
// run also compares the real `getModPositions` against `step` and throws if they
// disagree.
//
// WHAT IT SAYS, 2026-08-14, parse phase, positions identical in every row:
//
//   fixture                  strand  mean delta   jump    hybrid   control
//   ont.6ma.chr20 (72.8 Mbp)  both      1.40     1.088x   1.187x   1.009
//   ont.6ma.chr20             fwd       1.41     1.247x     —      1.004
//   200x.longread.mod         both     10.96     1.094x   1.263x   1.005
//   200x.longread.mod         fwd      10.81     1.560x     —      1.021
//   200x.longread.mod         rev      11.10     0.786x     —      0.972
//
// Over the whole per-read pipeline the hybrid is 1.109x (ONT) and 1.081x
// (sparse), the parse being roughly three quarters of it.
//
// **`lastIndexOf` IS NOT THE MIRROR OF `indexOf`, AND THAT IS THE WHOLE RESULT.**
// Jumping forward is 1.560x on the sparse fixture; the same change on reverse
// reads is 0.786x, i.e. materially SLOWER than stepping. Reverse is half the
// reads, so the obvious both-strands version nets 1.094x where branching on
// strand nets 1.263x — most of the win is thrown away by the half that loses.
// TODO said to measure reverse rather than assume symmetry, and that was right.
//
// **The regime matters much less than the strand.** A call every ~52 bases
// (sparse) jumps ~12 times instead of stepping ~52; a call every ~3.3 bases (ONT)
// jumps ~2.4 times instead of stepping ~3.3. That is a 2x spread in the ratio
// (1.560x vs 1.247x forward) against the 2x INVERSION the strand causes. Both
// regimes win forward, so there is no fixture-shape branch to make here.
//
// **`--overrun` FOUND A PRE-EXISTING BUG, WHICH IS WHY IT IS IN THE BENCH.** The
// stepping walk's do-while runs its body once per call regardless of currPos, so
// after one call had run off the end, every call after it emitted a position
// OUTSIDE the read — 8, 9, 10 on a length-8 forward read, and -3, -2, -1 on a
// reverse one. Only the FIRST unplaceable call landed in range. The comment
// asserting `currPos <= seqLength by loop invariant` was the bug: the invariant
// holds until the first overrun and not after. Those positions are used as
// indices into the read (`getMethBins`) and have to be ascending for the CIGAR
// walk, so they resolved to real reference positions somewhere wrong rather than
// being dropped. Fixed in `getModPositions` and pinned by unit tests; no read in
// any fixture overruns, which is exactly why nothing caught it.
//
// `--overrun` inflates the SECOND-to-last delta of every group past the end of
// the read, not the last: inflating the last would only exercise the first
// unplaceable call, and the first one was the case that already behaved. The
// same blind spot is why `multiGroupParse.bench.ts`'s one-pass arm could
// disagree with its baseline here and still report "output identical" for as
// long as it existed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import {
  getModPositions,
  isSingleModType,
  parseModHeader,
} from '@jbrowse/modifications-utils'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '20'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const FILE = arg('file', 'ont.6ma.chr20.bam')
const REFNAME = arg('refName', 'chr20')
const START = Number(arg('start', '1'))
const END = Number(arg('end', '100000000'))
const STRAND = arg('strand', 'both')
const OVERRUN = process.argv.includes('--overrun')

const THRESHOLD = 0.5

const COMPLEMENT_CODE: Record<number, number> = {
  65: 84,
  84: 65,
  67: 71,
  71: 67,
  78: 78,
}
const COMPLEMENT_CHAR: Record<string, string> = {
  A: 'T',
  T: 'A',
  C: 'G',
  G: 'C',
  N: 'N',
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
// ARM 1: step — the baseline this replaces, carrying the overrun clamp so the
// comparison is against fixed behaviour rather than against the bug.

function modPositionsStep(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const basemod = split[0]!
    const { base, strand, typestr } = parseModHeader(basemod, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const deltas = group.slice(basemod.length)
    const key = base + strand
    let positions: number[] | undefined
    if (seenKeys !== undefined) {
      for (let s = 0, n = seenKeys.length; s < n; s++) {
        if (seenKeys[s] === key && seenDeltas![s] === deltas) {
          positions = seenPositions![s]
          break
        }
      }
    }

    if (positions === undefined) {
      const baseCode = base.charCodeAt(0)
      const targetCode = isRev
        ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
        : baseCode
      const isN = base === 'N'
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0
      let currPos = 0

      for (let i = 1; i < splitLength; i++) {
        // The read ran out on an earlier call. Without this the do-while below
        // still runs its body once, walking currPos past seqLength and emitting
        // a position OUTSIDE the read — 8, 9, 10 on a length-8 read forward, and
        // -1, -2, -3 reverse. See the `--overrun` note in the header.
        if (currPos >= seqLength) {
          if (isRev) {
            positions[writeIndex--] = 0
          } else {
            positions[writeIndex++] = seqLength - 1
          }
          continue
        }
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

      if (seenKeys === undefined) {
        seenKeys = [key]
        seenDeltas = [deltas]
        seenPositions = [positions]
      } else {
        seenKeys.push(key)
        seenDeltas!.push(deltas)
        seenPositions!.push(positions)
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

// ---------------------------------------------------------------------------
// ARM 2: jump — `delta + 1` native searches instead of `distance` steps.
//
// The forward form searches upward from `currPos` and records the hit's index.
// The reverse form is NOT a mirror image and this is the half the probe never
// measured: the shipped walk reads fseq from the back while complementing the
// target, so the equivalent search is `lastIndexOf` of the COMPLEMENT, walking
// down. The index it lands on is already the value to record — the shipped
// `seqLength - currPos` arithmetic cancels out to exactly that — so the reverse
// arm records `at` and not a transform of it.

function modPositionsJump(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const basemod = split[0]!
    const { base, strand, typestr } = parseModHeader(basemod, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const deltas = group.slice(basemod.length)
    const key = base + strand
    let positions: number[] | undefined
    if (seenKeys !== undefined) {
      for (let s = 0, n = seenKeys.length; s < n; s++) {
        if (seenKeys[s] === key && seenDeltas![s] === deltas) {
          positions = seenPositions![s]
          break
        }
      }
    }

    if (positions === undefined) {
      const target = isRev ? (COMPLEMENT_CHAR[base] ?? base) : base
      const isN = base === 'N'
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0

      if (isRev) {
        // `j` is the highest fseq index still to be searched. It starts at the
        // last base and walks down.
        let j = seqLength - 1
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            // Every base matches, so the (delta+1)-th is delta below j — no scan.
            at = j - delta
            if (at < 0) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              if (j < 0) {
                at = -1
                break
              }
              at = fseq.lastIndexOf(target, j)
              if (at < 0) {
                break
              }
              j = at - 1
            }
          }
          if (at < 0) {
            // The base ran out. The stepping form clamps to 0 here, and clamps
            // every remaining call too, because currPos stays at seqLength.
            j = -1
            positions[writeIndex--] = 0
          } else {
            j = at - 1
            positions[writeIndex--] = at
          }
        }
      } else {
        let currPos = 0
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = currPos + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(target, currPos)
              if (at < 0) {
                break
              }
              currPos = at + 1
            }
          }
          if (at < 0) {
            currPos = seqLength
            positions[writeIndex++] = seqLength - 1
          } else {
            currPos = at + 1
            positions[writeIndex++] = at
          }
        }
      }

      if (seenKeys === undefined) {
        seenKeys = [key]
        seenDeltas = [deltas]
        seenPositions = [positions]
      } else {
        seenKeys.push(key)
        seenDeltas!.push(deltas)
        seenPositions!.push(positions)
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

// ---------------------------------------------------------------------------
// ARM 3: hybrid — jump forward, step reverse. This is the shape to ship, and it
// exists because ARM 2 measured 1.560x forward and 0.786x reverse on the same
// fixture: `lastIndexOf` is not the mirror of `indexOf`. Nothing else differs
// between the two branches, so a read pays the better of the two either way.

function modPositionsHybrid(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const basemod = split[0]!
    const { base, strand, typestr } = parseModHeader(basemod, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const deltas = group.slice(basemod.length)
    const key = base + strand
    let positions: number[] | undefined
    if (seenKeys !== undefined) {
      for (let s = 0, n = seenKeys.length; s < n; s++) {
        if (seenKeys[s] === key && seenDeltas![s] === deltas) {
          positions = seenPositions![s]
          break
        }
      }
    }

    if (positions === undefined) {
      const isN = base === 'N'
      if (isRev) {
        // Unchanged from what ships.
        const baseCode = base.charCodeAt(0)
        const targetCode = COMPLEMENT_CODE[baseCode] ?? baseCode
        positions = new Array<number>(nPositions)
        let writeIndex = nPositions - 1
        let currPos = 0
        for (let i = 1; i < splitLength; i++) {
          if (currPos >= seqLength) {
            positions[writeIndex--] = 0
            continue
          }
          let delta = +split[i]!
          do {
            if (
              isN ||
              fseq.charCodeAt(seqLength - 1 - currPos) === targetCode
            ) {
              delta--
            }
            currPos++
          } while (delta >= 0 && currPos < seqLength)
          positions[writeIndex--] = seqLength - currPos
        }
      } else {
        positions = []
        let writeIndex = 0
        let currPos = 0
        for (let i = 1; i < splitLength; i++) {
          const delta = +split[i]!
          let at = -1
          if (isN) {
            at = currPos + delta
            if (at >= seqLength) {
              at = -1
            }
          } else {
            for (let k = 0; k <= delta; k++) {
              at = fseq.indexOf(base, currPos)
              if (at < 0) {
                break
              }
              currPos = at + 1
            }
          }
          if (at < 0) {
            currPos = seqLength
            positions[writeIndex++] = seqLength - 1
          } else {
            currPos = at + 1
            positions[writeIndex++] = at
          }
        }
      }

      if (seenKeys === undefined) {
        seenKeys = [key]
        seenDeltas = [deltas]
        seenPositions = [positions]
      } else {
        seenKeys.push(key)
        seenDeltas!.push(deltas)
        seenPositions!.push(positions)
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

// ---------------------------------------------------------------------------
// ARM 4: control — a second, separately-declared copy of ARM 1.

function modPositionsControl(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  let mlBase = 0
  let seenKeys: string[] | undefined
  let seenDeltas: string[] | undefined
  let seenPositions: number[][] | undefined

  for (const group of groups) {
    if (group === '') {
      continue
    }
    const split = group.split(',')
    const basemod = split[0]!
    const { base, strand, typestr } = parseModHeader(basemod, group)
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length
    const splitLength = split.length
    const nPositions = splitLength - 1

    const deltas = group.slice(basemod.length)
    const key = base + strand
    let positions: number[] | undefined
    if (seenKeys !== undefined) {
      for (let s = 0, n = seenKeys.length; s < n; s++) {
        if (seenKeys[s] === key && seenDeltas![s] === deltas) {
          positions = seenPositions![s]
          break
        }
      }
    }

    if (positions === undefined) {
      const baseCode = base.charCodeAt(0)
      const targetCode = isRev
        ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
        : baseCode
      const isN = base === 'N'
      positions = isRev ? new Array<number>(nPositions) : []
      let writeIndex = isRev ? nPositions - 1 : 0
      let currPos = 0

      for (let i = 1; i < splitLength; i++) {
        // The read ran out on an earlier call. Without this the do-while below
        // still runs its body once, walking currPos past seqLength and emitting
        // a position OUTSIDE the read — 8, 9, 10 on a length-8 read forward, and
        // -1, -2, -3 reverse. See the `--overrun` note in the header.
        if (currPos >= seqLength) {
          if (isRev) {
            positions[writeIndex--] = 0
          } else {
            positions[writeIndex++] = seqLength - 1
          }
          continue
        }
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

      if (seenKeys === undefined) {
        seenKeys = [key]
        seenDeltas = [deltas]
        seenPositions = [positions]
      } else {
        seenKeys.push(key)
        seenDeltas!.push(deltas)
        seenPositions!.push(positions)
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

// ---------------------------------------------------------------------------
// The walk and emit, shared: they do not vary across the arms.

function walk(
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

function emit(r: Read, mods: Mod[], entries: Entry[]) {
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
    walk(r.ops, positions, (ref, idx) => {
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

type Parse = (mm: string, fseq: string, fstrand: number) => Mod[]

function runParse(reads: Read[], parse: Parse) {
  let sink = 0
  for (const r of reads) {
    for (const m of parse(r.mm, r.seq, r.strand)) {
      sink += m.positions.length
    }
  }
  return sink
}

function runPipeline(reads: Read[], parse: Parse) {
  const entries: Entry[] = []
  for (const r of reads) {
    emit(r, parse(r.mm, r.seq, r.strand), entries)
  }
  return entries
}

// The emit drops anything under the probability threshold, so comparing only the
// pipeline output would hide a positions disagreement on a low-probability call.
// This compares every position of every group instead — walking the two in step
// rather than serializing, because joining 21.8M positions into strings costs
// more memory than the whole bench.
function firstPositionsDifference(reads: Read[], a: Parse, b: Parse) {
  for (const r of reads) {
    const ma = a(r.mm, r.seq, r.strand)
    const mb = b(r.mm, r.seq, r.strand)
    if (ma.length !== mb.length) {
      return `read ${r.index}: ${ma.length} vs ${mb.length} groups`
    }
    for (let g = 0; g < ma.length; g++) {
      const pa = ma[g]!.positions
      const pb = mb[g]!.positions
      if (pa.length !== pb.length) {
        return `read ${r.index} group ${g}: ${pa.length} vs ${pb.length} positions`
      }
      for (let i = 0; i < pa.length; i++) {
        if (pa[i] !== pb[i]) {
          return (
            `read ${r.index} group ${g} (${ma[g]!.base}${ma[g]!.type}) ` +
            `position ${i} of ${pa.length}: ${pa[i]} vs ${pb[i]} ` +
            `[strand ${r.strand}, seqLength ${r.seq.length}]`
          )
        }
      }
    }
  }
  return ''
}

function serialize(out: Entry[]) {
  return out.map(
    e =>
      `${e.readIndex} ${e.position} ${e.modType} ${e.base} ${e.prob.toFixed(6)}`,
  )
}

function firstDifference(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return `length ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      const x = a[i]!
      const y = b[i]!
      return `entry ${i}: "${x.slice(0, 90)}" vs "${y.slice(0, 90)}"`
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
    const strand = r.strand === -1 ? -1 : 1
    if (
      (STRAND === 'fwd' && strand !== 1) ||
      (STRAND === 'rev' && strand !== -1)
    ) {
      continue
    }
    reads.push({
      index: i,
      start: r.start,
      strand,
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
  let reads = toReads(records)
  if (reads.length === 0) {
    console.log('no MM/ML reads in range')
    return
  }
  if (OVERRUN) {
    // Push the SECOND-to-last delta of every group past whatever the read has
    // left. Inflating the last one would only exercise the first clamp; the rule
    // is that the walk clamps that call and every call after it, because currPos
    // stays at seqLength, so the overrun has to be followed by another call.
    reads = reads.map(r => {
      const groups = r.mm.split(';').map(group => {
        if (group === '') {
          return group
        }
        const split = group.split(',')
        if (split.length < 2) {
          return group
        }
        split[Math.max(1, split.length - 2)] = String(r.seq.length + 1)
        return split.join(',')
      })
      return { ...r, mm: groups.join(';') }
    })
  }

  let bases = 0
  let calls = 0
  let deltaSum = 0
  let fwd = 0
  for (const r of reads) {
    bases += r.seq.length
    if (r.strand === 1) {
      fwd++
    }
    for (const group of r.mm.split(';')) {
      if (group === '') {
        continue
      }
      const split = group.split(',')
      for (let i = 1; i < split.length; i++) {
        calls++
        deltaSum += +split[i]!
      }
    }
  }
  const meanDelta = deltaSum / calls
  // Bases between calls, which is what the stepping form walks per call and what
  // the `meanDelta + 1` native searches have to beat.
  const stepsPerCall = bases / calls

  const diffPos = firstPositionsDifference(
    reads,
    modPositionsStep,
    modPositionsJump,
  )
  const diffHyb = firstPositionsDifference(
    reads,
    modPositionsStep,
    modPositionsHybrid,
  )
  const diffCtlPos = firstPositionsDifference(
    reads,
    modPositionsStep,
    modPositionsControl,
  )
  if (diffCtlPos) {
    throw new Error(
      `the control disagrees with the baseline it was copied from (${diffCtlPos}) — the harness is broken`,
    )
  }

  // Every arm above is a hand-copy of the algorithm, so agreeing with each other
  // proves only that the copies match. This compares the SHIPPED function, which
  // is the thing the ratios are meant to be about.
  const diffShipped = firstPositionsDifference(
    reads,
    modPositionsStep,
    (mm, fseq, fstrand) => getModPositions(mm, fseq, fstrand),
  )
  if (diffShipped) {
    throw new Error(
      `getModPositions disagrees with this bench's stepping baseline (${diffShipped}) — one of the two is wrong, and the shipped one matters`,
    )
  }

  const outStep = serialize(runPipeline(reads, modPositionsStep))
  const outJump = serialize(runPipeline(reads, modPositionsJump))
  const diffOut = firstDifference(outStep, outJump)

  const best = {
    parseStep: Infinity,
    parseJump: Infinity,
    parseHyb: Infinity,
    parseCtl: Infinity,
    pipeStep: Infinity,
    pipeJump: Infinity,
    pipeHyb: Infinity,
    pipeCtl: Infinity,
  }
  const sides = [
    { k: 'parseStep' as const, run: () => runParse(reads, modPositionsStep) },
    { k: 'parseJump' as const, run: () => runParse(reads, modPositionsJump) },
    { k: 'parseHyb' as const, run: () => runParse(reads, modPositionsHybrid) },
    { k: 'parseCtl' as const, run: () => runParse(reads, modPositionsControl) },
    { k: 'pipeStep' as const, run: () => runPipeline(reads, modPositionsStep) },
    { k: 'pipeJump' as const, run: () => runPipeline(reads, modPositionsJump) },
    {
      k: 'pipeHyb' as const,
      run: () => runPipeline(reads, modPositionsHybrid),
    },
    {
      k: 'pipeCtl' as const,
      run: () => runPipeline(reads, modPositionsControl),
    },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }

  const xp = (v: number) => `${(best.parseStep / v).toFixed(3)}x`
  const xl = (v: number) => `${(best.pipeStep / v).toFixed(3)}x`
  console.log(
    `MM delta walk: step one base at a time, or jump with indexOf\n` +
      `${FILE} ${REFNAME}:${START}-${END}, strand=${STRAND}${OVERRUN ? ', OVERRUN' : ''}, min of ${ROUNDS} rotated rounds\n` +
      `  ${reads.length} MM reads (${fwd} fwd / ${reads.length - fwd} rev), ` +
      `${(bases / 1e6).toFixed(2)} Mbp, ${(calls / 1e6).toFixed(2)}M calls\n` +
      `  mean delta ${meanDelta.toFixed(2)}, so ~${(meanDelta + 1).toFixed(1)} native searches ` +
      `against ~${stepsPerCall.toFixed(1)} stepped bases per call\n\n` +
      `  parse only\n` +
      `    step        ${best.parseStep.toFixed(2).padStart(8)} ms   <- ships\n` +
      `    jump        ${best.parseJump.toFixed(2).padStart(8)} ms   ${xp(best.parseJump)}   ` +
      `positions ${diffPos ? `DIFFER — ${diffPos}` : 'identical'}\n` +
      `    hybrid      ${best.parseHyb.toFixed(2).padStart(8)} ms   ${xp(best.parseHyb)}   ` +
      `positions ${diffHyb ? `DIFFER — ${diffHyb}` : 'identical'}\n` +
      `    control     ${best.parseCtl.toFixed(2).padStart(8)} ms   ${xp(best.parseCtl)}   <- noise floor\n\n` +
      `  parse + CIGAR walk + emit\n` +
      `    step        ${best.pipeStep.toFixed(2).padStart(8)} ms   <- ships\n` +
      `    jump        ${best.pipeJump.toFixed(2).padStart(8)} ms   ${xl(best.pipeJump)}   ` +
      `output ${diffOut ? `DIFFERS — ${diffOut}` : 'identical'}\n` +
      `    hybrid      ${best.pipeHyb.toFixed(2).padStart(8)} ms   ${xl(best.pipeHyb)}\n` +
      `    control     ${best.pipeCtl.toFixed(2).padStart(8)} ms   ${xl(best.pipeCtl)}   <- noise floor\n`,
  )
}

await main()
