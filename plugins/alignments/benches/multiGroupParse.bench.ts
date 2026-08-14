// A read with three MM groups walks its sequence three times. It could walk once.
//
//   node --expose-gc plugins/alignments/benches/multiGroupParse.bench.ts
//   node --expose-gc plugins/alignments/benches/multiGroupParse.bench.ts \
//     --file=200x.longread.mod.bam --refName=chr22_mask --start=1 --end=400000
//
// Flags: --rounds=<n> (default 40), --bam=<dir>, --file, --refName, --start,
// --end
//
// The harness rules are in agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. `getModPositions` restarts `currPos = 0` for every MM group,
// because each group counts occurrences of its own canonical base. A Fiber-seq
// read carries `C+m;A+a;T-a` — 5mC on cytosine, 6mA on adenine, and 6mA's
// reverse-strand partner — so it walks its read sequence **three times**.
//
// htslib does not. `bam_next_basemod` keeps a countdown per type and makes ONE
// pass, decrementing every counter by the base frequencies it observed
// (`agent-docs/reference/MODIFICATION_TAGS.md` has it against ours line by line).
// This bench is that shape, writing into the same `positions` arrays our
// consumers need rather than streaming.
//
// **THE FIXTURE.** `ont.6ma.chr20.bam` (jb2bench `shell/fetch_ont_6ma.sh`) is a
// 2 Mb slice of ONT's public chromatin-accessibility run for HG002: 8,166 MM
// reads, 72.8 Mbp, 21.81M MM deltas at 2,310 calls per read — ~26x the calls of
// the single-group fixture — and every read is `A+a.;C+h?;C+m?`. Three groups.
// `modPhases.bench.ts` on it puts **parse at 71% of the pipeline** against 46% on
// the single-group fixture, which is the tripled sequence walk showing up.
//
// **DO NOT RUN THIS ON A SMALL FIXTURE AND BELIEVE IT.** The first multi-group
// file tried here was `HG002_WGS_fiberseq.MAGEL2.bam` — real, three-group, and
// 0.55 Mbp. It reported **1.431x**. The same arms on 72.8 Mbp report 1.13x. Both
// had clean controls; the small one is not noise, it is a different regime — 570
// calls per read against 2,310, so the per-call work that both arms share is a
// far smaller fraction of it, and the saved sequence passes look correspondingly
// bigger. A fixture that fits in cache prices the loop and not the workload.
//
// THREE ARMS, all three carrying the same-base merge, because it ships:
//   perGroup    — what ships: one sequence pass per DISTINCT group
//   onePass     — one pass for all groups, htslib's shape. Groups are bucketed by
//                 the canonical base they count, so a base is charged to the one
//                 group that cares rather than tested against all of them
//   control     — a second, separately-declared copy of `perGroup`
//
// The CIGAR walk and the emit are SHARED, deliberately: they do not vary across
// the arms and every arm reaches them identically, which is the condition
// BENCHMARKING.md's polymorphism trap does not apply to. Only the parse differs,
// so only the parse is written out twice.
//
// **WHAT IT SAID FIRST, AND WHY THAT IS SUPERSEDED.** Measured 2026-08-14 against
// a baseline that walked once per GROUP, this reported 1.133x on ont.6ma.chr20,
// 0.917x on the single-group fixture and 1.431x on fiberseq, and concluded: ship
// it branched on group count, crossover unknown. Then the same-base merge landed
// in `getModPositions` (`sameBaseMerge.bench.ts`), the baseline stopped walking
// twice for dorado's two C groups, and every arm here now carries that merge
// because it is the baseline rather than a candidate.
//
// WHAT IT SAYS NOW, 2026-08-14, output identical in every row:
//
//   fixture                     groups  distinct   per group   one pass          control
//   ont.6ma.chr20 (72.8 Mbp)     3.00     2.00     1667.7 ms  1758.2 ms 0.949x  0.980
//   200x.longread.mod, --groups=2 2.00    2.00     1200.0 ms  1289.9 ms 0.930x  0.979
//   200x.longread.mod (43.7 Mbp) 1.00     1.00      509.7 ms   555.5 ms 0.917x  1.000
//   fiberseq.MAGEL2 (0.55 Mbp)   2.86     2.86       11.1 ms     8.0 ms 1.385x  0.993
//
// **THE CROSSOVER IS BETWEEN TWO AND THREE DISTINCT GROUPS, AND THAT KILLS THIS
// FOR ONT DATA.** One pass loses at one distinct group (0.917x), loses at two
// whether they are synthesized (0.930x) or real (0.949x), and wins only at the
// 2.86 of fiberseq (1.385x). The one-pass shape charges every base an array index
// and a handful of property loads where the per-group loop is a tight do-while
// over `charCodeAt`; two saved passes do not cover that, three do.
//
// So the 1.133x this bench used to report on ont.6ma.chr20 was real, and the
// merge took it: `A+a.;C+h?;C+m?` is three groups but only **two distinct walks**
// once the C pair shares an array, and at two the shape is a loss. What is left
// is Fiber-seq — `C+m;A+a;T-a`, three genuinely different bases — so this is not
// a general parse optimization but a Fiber-seq one, and it should not be shipped
// on a group count that counts duplicates.
//
// **`--groups=` FOUND A REAL BUG IN THE ONE-PASS ARM, NOT JUST A NUMBER.** Its
// first run reported `output DIFFERS`. Two causes, both fixed here and both worth
// knowing:
//
//   - The synthesis counted occurrences of `b` in fseq, but on a reverse read the
//     walk counts the COMPLEMENT of `b`. So it declared more calls than the read
//     had bases for, on about half the reads.
//   - Which then ran off the end of the sequence, where **the two arms did not
//     agree**: the per-group shape clamps and records `seqLength - 1` (forward)
//     or `0` (reverse) for every call it cannot place, and this arm silently
//     dropped them. Every row above ever reading "output identical" only meant no
//     read in those fixtures overran. It is the same end-of-sequence rule TODO's
//     `indexOf` entry singles out as the thing to get exactly right, and it is a
//     hard constraint on ever shipping this shape.
//
// **The first cut of the one-pass arm was 0.890x, i.e. slower**, and the whole
// difference was a `Map.get(seqCode)` per read base rather than an array index.
// Worth knowing before concluding a shape does not pay: at 72.8 Mbp the per-base
// path is executed 218 million times and nothing about it is free.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { isSingleModType, parseModHeader } from '@jbrowse/modifications-utils'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const FILE = arg('file', 'HG002_WGS_fiberseq.MAGEL2.bam')
const REFNAME = arg('refName', 'chr15')
const START = Number(arg('start', '1'))
const END = Number(arg('end', '100000000'))
// Synthesize extra MM groups, to find where the crossover between the two shapes
// is. `--groups=2` adds an `A+a` group beside each read's existing one, with real
// A positions walked out of the read's own sequence and the ML bytes repeated so
// the second group emits too. Positions are real; only the fact that this read
// carries two groups is invented.
const GROUPS = Number(arg('groups', '0'))

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
// ARM 1: perGroup — what ships.

function modPositionsPerGroup(mm: string, fseq: string, fstrand: number) {
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

    // The same-base merge, which SHIPS — see `getModPositions`. It is in every
    // arm because it is the baseline now, not a candidate.
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
// ARM 2: onePass — htslib's shape.

interface GroupState {
  targetCode: number
  isN: boolean
  positions: number[]
  writeIndex: number
  step: number
  split: string[]
  next: number
  countdown: number
  done: boolean
}

function modPositionsOnePass(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const groups = mm.split(';')
  const result: Mod[] = []
  const states: GroupState[] = []
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
    const nPositions = split.length - 1

    // A duplicate group gets no state at all: one pass over N groups is only
    // ever a pass over the DISTINCT ones, which is the whole point of measuring
    // this against the merged baseline rather than the old one.
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
      positions = isRev ? new Array<number>(nPositions) : []

      const st: GroupState = {
        targetCode,
        isN: base === 'N',
        positions,
        writeIndex: isRev ? nPositions - 1 : 0,
        step: isRev ? -1 : 1,
        split,
        next: 2,
        countdown: nPositions > 0 ? +split[1]! : -1,
        done: nPositions === 0,
      }
      states.push(st)

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

  // Bucket by the base each group counts, so a base is charged to the group that
  // cares rather than tested against every group. 'N' groups match every base and
  // are kept apart.
  // Indexed by char code rather than a Map: a Map.get per read base was the
  // first shape tried and it measured 0.890x, i.e. slower than three passes.
  const byCode: (GroupState[] | undefined)[] = new Array(128)
  const anyBase: GroupState[] = []
  for (const st of states) {
    if (st.done) {
      continue
    }
    if (st.isN) {
      anyBase.push(st)
    } else {
      let l = byCode[st.targetCode]
      if (l === undefined) {
        l = []
        byCode[st.targetCode] = l
      }
      l.push(st)
    }
  }

  let live = states.reduce((a, s) => a + (s.done ? 0 : 1), 0)
  for (let currPos = 0; currPos < seqLength && live > 0; currPos++) {
    const seqCode = isRev
      ? fseq.charCodeAt(seqLength - 1 - currPos)
      : fseq.charCodeAt(currPos)
    const bucket = byCode[seqCode]
    if (bucket !== undefined) {
      for (let b = 0; b < bucket.length; b++) {
        const st = bucket[b]!
        if (st.done) {
          continue
        }
        if (--st.countdown < 0) {
          st.positions[st.writeIndex] = isRev
            ? seqLength - currPos - 1
            : currPos
          st.writeIndex += st.step
          if (st.next < st.split.length) {
            st.countdown = +st.split[st.next++]!
          } else {
            st.done = true
            live--
          }
        }
      }
    }
    for (let a = 0; a < anyBase.length; a++) {
      const st = anyBase[a]!
      if (st.done) {
        continue
      }
      if (--st.countdown < 0) {
        st.positions[st.writeIndex] = isRev ? seqLength - currPos - 1 : currPos
        st.writeIndex += st.step
        if (st.next < st.split.length) {
          st.countdown = +st.split[st.next++]!
        } else {
          st.done = true
          live--
        }
      }
    }
  }

  // The sequence ran out before these groups placed every call they declare —
  // an MM tag is free to ask for more of a base than remains. The per-group
  // shape runs its inner loop to `seqLength` and records `seqLength - 1`
  // (forward) or `0` (reverse) for each call it could not place, so this has to
  // do the same or the two arms disagree on exactly those reads.
  //
  // **They did.** This arm dropped them instead, and every published row still
  // read "output identical" because no read in those fixtures overran. What
  // surfaced it was `--groups=2`, whose synthesized group WAS overrunning, for
  // its own unrelated reason (fixed below). Left alone it would have made the
  // crossover number meaningless, and it is a hard constraint on ever shipping
  // this shape — the same end-of-sequence rule the `indexOf` probe in TODO.md is
  // careful to reproduce.
  const clamp = isRev ? 0 : seqLength - 1
  for (const st of states) {
    if (st.done) {
      continue
    }
    let pending = 1 + (st.split.length - st.next)
    while (pending-- > 0) {
      st.positions[st.writeIndex] = clamp
      st.writeIndex += st.step
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// ARM 3: control — a second, separately-declared copy of ARM 1.

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

function runPerGroup(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    emit(r, modPositionsPerGroup(r.mm, r.seq, r.strand), entries)
  }
  return entries
}

function runOnePass(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    emit(r, modPositionsOnePass(r.mm, r.seq, r.strand), entries)
  }
  return entries
}

function runControl(reads: Read[]) {
  const entries: Entry[] = []
  for (const r of reads) {
    emit(r, modPositionsControl(r.mm, r.seq, r.strand), entries)
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
  if (GROUPS > 1) {
    const extra = ['A', 'G', 'T'].slice(0, GROUPS - 1)
    reads = reads.map(r => {
      let mm = r.mm.endsWith(';') ? r.mm : `${r.mm};`
      for (const b of extra) {
        // Every occurrence of `b`, as a delta list of zeroes — the densest legal
        // encoding, and the positions are wherever that base really is.
        //
        // On a REVERSE read the walk counts the complement of `b`, because it
        // reads fseq from the back rather than revcom-ing it. Counting `b`
        // itself here declared more calls than the read had bases for on about
        // half the reads, which overran the end of the sequence — where the two
        // arms turned out to disagree. That is what this flag first found.
        const target =
          r.strand === -1
            ? String.fromCharCode(COMPLEMENT_CODE[b.charCodeAt(0)]!)
            : b
        let n = 0
        for (let i = 0; i < r.seq.length; i++) {
          if (r.seq.charCodeAt(i) === target.charCodeAt(0)) {
            n++
          }
        }
        mm += `${b}+a?${',0'.repeat(n)};`
      }
      const per = r.ml.length
      const ml = new Uint8Array(per * GROUPS)
      for (let g = 0; g < GROUPS; g++) {
        for (let i = 0; i < per; i++) {
          ml[g * per + i] = r.ml[i]!
        }
      }
      return { ...r, mm, ml }
    })
  }
  if (reads.length === 0) {
    console.log('no MM/ML reads in range')
    return
  }

  let bases = 0
  let groups = 0
  let distinct = 0
  for (const r of reads) {
    bases += r.seq.length
    const seen: string[] = []
    for (const group of r.mm.split(';')) {
      if (group === '') {
        continue
      }
      groups++
      const basemod = group.split(',')[0]!
      const { base, strand } = parseModHeader(basemod, group)
      const k = base + strand + group.slice(basemod.length)
      if (!seen.includes(k)) {
        seen.push(k)
        distinct++
      }
    }
  }
  const meanGroups = groups / reads.length
  // What the baseline actually walks, which since the same-base merge landed is
  // the DISTINCT count, not the group count. Reporting groups/read here is how
  // the ONT row came to claim three passes a read against a baseline making two.
  const meanDistinct = distinct / reads.length

  const outPerGroup = serialize(runPerGroup(reads))
  const outOnePass = serialize(runOnePass(reads))
  const outControl = serialize(runControl(reads))

  const diffOnePass = firstDifference(outPerGroup, outOnePass)
  const diffControl = firstDifference(outPerGroup, outControl)
  if (diffControl) {
    throw new Error(
      `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
    )
  }

  const best = { per: Infinity, one: Infinity, ctl: Infinity }
  const sides = [
    { k: 'per' as const, run: () => runPerGroup(reads) },
    { k: 'one' as const, run: () => runOnePass(reads) },
    { k: 'ctl' as const, run: () => runControl(reads) },
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }
  const x = (v: number) => `${(best.per / v).toFixed(3)}x`
  console.log(
    `multi-group parse: one pass per group vs one pass total\n` +
      `${FILE} ${REFNAME}:${START}-${END}, min of ${ROUNDS} rotated rounds\n` +
      `  ${reads.length} MM reads, ${(bases / 1e6).toFixed(2)} Mbp, ` +
      `${meanGroups.toFixed(2)} MM groups/read (${meanDistinct.toFixed(2)} distinct after the merge), ` +
      `${outPerGroup.length} marks emitted\n` +
      `  so the shipped shape makes ${((bases * meanDistinct) / 1e6).toFixed(2)} Mbp of sequence passes ` +
      `where one pass would make ${(bases / 1e6).toFixed(2)}\n\n` +
      `  per group     ${best.per.toFixed(2).padStart(8)} ms   <- ships\n` +
      `  one pass      ${best.one.toFixed(2).padStart(8)} ms   ${x(best.one)}   ` +
      `output ${diffOnePass ? `DIFFERS — ${diffOnePass}` : 'identical'}\n` +
      `  control       ${best.ctl.toFixed(2).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
  )
}

await main()
