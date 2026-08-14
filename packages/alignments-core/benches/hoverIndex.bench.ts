// What does a hover over the coverage band cost — scanning, side-indexed, or
// sorted at the producer?
//
//   node --expose-gc packages/alignments-core/benches/hoverIndex.bench.ts
//
// Flags: --rounds=<n> (default 25), --hovers=<n> (default 200),
//        --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. The per-event arrays were built in READ order, so every per-hover
// reader of them scanned the whole array to find the entries under the cursor. A
// hover is a mousemove, and the coverage band fires two of these readers per
// motion (`findSignificantInBin` from the hit test, then `countSnpsAtPosition`
// from the tooltip) per block, per stacked BAM track.
//
// There were two candidate fixes and this bench now compares BOTH, because the
// first one shipped and was then replaced:
//
//   a side index, memoized on the main thread against the array — log-time
//   hovers, but 8 bytes an entry retained per region per track, an invalidation
//   invariant nothing enforces, and an `order[k]` indirection per entry;
//
//   sorting at the PRODUCER, so `mismatchPositions` arrives ascending — the same
//   log-time hover with nothing retained, nothing to invalidate, and no
//   indirection. This is what ships.
//
// THREE COSTS, and the third is the one a reader will want and not think to ask
// for:
//
//   hover        the per-mousemove work, three ways
//   index-build  the sort the INDEX added, on the main thread, on the first hover
//                after each fetch — the stall the producer sort deletes
//   worker-sort  the sort the PRODUCER adds: the same sort plus permuting the
//                parallel arrays, so strictly more work than index-build. In the
//                worker, once per fetch, off the interaction path.
//
// A structure that turns a 3ms scan into a 200ms sort has made the thing worse at
// the moment a user first touches the band, which is why both one-offs are
// reported in the same units as the hovers rather than assumed free.
//
// ARMS:
//   scan-hover     the original: a full scan of the read-order array
//   index-hover    the previous implementation, transcribed — read-order array
//                  plus `positionIndexFor`
//   sorted-hover   what ships: the shared readers over ascending arrays
//   control        a second, separately-declared copy of scan-hover. A row whose
//                  control is far from 1.00 measured nothing.
//
// SYNTHETIC FIXTURES: mismatch arrays the size a pileup ships, in read order
// (shuffled), over a window the width of a fetched block. The sorted arm gets the
// same events permuted, which is what the worker now emits.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Three samples, --rounds=25 --hovers=200, ms per 200 hovers,
// control in brackets. Taken 2026-08-14 ON AC, adapter verified online, 16 cores
// under a load average of ~4-5 from other work on the box:
//
//   longread-400k   scan 1283.8  index 0.21  sorted 0.17  [0.99]  build  4.26  sort  7.38
//                   scan 1312.1  index 0.21  sorted 0.17  [1.01]  build  4.36  sort  7.48
//                   scan  632.2  index 0.22  sorted 0.17  [0.49]  build  4.15  sort  7.34
//   shortread-40k   scan   60.1  index 0.08  sorted 0.08  [1.00]  build  0.61  sort  0.71
//                   scan   60.2  index 0.09  sorted 0.08  [1.00]  build  0.63  sort  0.75
//                   scan   67.5  index 0.11  sorted 0.09  [0.99]  build  0.71  sort  0.83
//   deep-1m         scan 1472.2  index 0.30  sorted 0.22  [1.01]  build 10.01  sort 14.66
//                   scan 1571.6  index 0.30  sorted 0.23  [1.00]  build 10.74  sort 16.01
//                   scan 1593.2  index 0.34  sorted 0.23  [0.98]  build 11.79  sort 16.04
//
// EIGHT OF NINE ROWS hold their control at 0.98-1.01. The exception is
// longread-400k's third sample at 0.49, where the scan arm got an uncontended run
// (632ms against a 1303ms control) — that row measured nothing and is kept so a
// reader does not wonder why its scan column is half the other two.
//
// **The power state is the reason this block was re-measured.** An earlier run of
// the same three samples on BATTERY put longread-400k's control at 0.60/1.83/1.44
// and its scan arm anywhere between 873 and 1733ms. On AC the same fixture holds
// twice out of three. BENCHMARKING.md names coming off AC as a trap; this is the
// worked instance, and the lesson is that it corrupted the arm ORDERING (whichever
// ran as the clock ramped) rather than adding symmetric noise — which is exactly
// why a control catches it and a standard deviation would not.
//
// SORTED BEATS THE INDEX, which is worth stating plainly because the motivation
// for the change was architectural rather than performance: 0.22-0.23 vs 0.30-0.34
// on deep-1m (1.30-1.48x), 0.17 vs 0.21 on longread (1.24x), and a wash to 1.22x
// on shortread where both are near the timer's resolution. Both are the same
// log-time answer; the difference is the `order[k]` indirection the index needs to
// reach the parallel arrays and the sorted form does not. So removing the memo
// cost nothing and returned something.
//
// The hover columns are stable to two significant figures across every sample
// while the scan column swings, which is what a log-time answer looks like: it
// does not care how big the array is, so the ratios vary only because the
// BASELINE does.
//
// Per single mousemove on the deep fixture that is 7.4ms -> 0.0011ms, in ONE block
// of ONE track; a six-track view pays it six times.
//
// THE ONE-OFF MOVED AND GREW, and both halves matter. `worker-sort` is 1.2-1.7x
// `index-build` (14.7 vs 10.0ms on deep-1m, 7.4 vs 4.3 on longread) because it
// permutes five parallel arrays where the index only built two. But `index-build`
// ran on the MAIN THREAD, on the first mousemove after every fetch, and
// `worker-sort` runs in the worker beside work already O(n) — so the interaction
// path lost a 10ms stall and gained nothing. Against the scan it replaces (1472ms
// over 200 hovers) either is paid back within two pointer motions.
//
// The ratios here are far larger than "one scan replaced by one binary search"
// suggests because a hover fires BOTH readers, and the baseline's
// `findSignificantInBin` also allocated a Map while it scanned.

import {
  countSnpsAtPosition,
  findSignificantInBin,
} from '../src/coverageDownsampling.ts'
import {
  lowerBound,
  positionIndexFor,
  positionOrder,
} from '../src/positionIndex.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const ROUNDS = Number(arg('rounds', '25'))
const HOVERS = Number(arg('hovers', '200'))
const ONLY = arg('only', '')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// BASELINE. The scans these two functions used to be, transcribed.
const scanSnps = (
  position: number,
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  mismatchStrands: Int8Array,
) => {
  const snps: Record<string, { count: number; fwd: number; rev: number }> = {}
  for (let i = 0; i < mismatchPositions.length; i++) {
    if (mismatchPositions[i] === position) {
      const base = String.fromCharCode(mismatchBases[i]!)
      snps[base] ??= { count: 0, fwd: 0, rev: 0 }
      snps[base].count++
      if (mismatchStrands[i] === 1) {
        snps[base].fwd++
      } else if (mismatchStrands[i] === -1) {
        snps[base].rev++
      }
    }
  }
  return snps
}

const scanSignificant = (
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) => {
  const hitsByPos = new Map<number, number>()
  for (const pos of positions) {
    if (pos >= binStart && pos < binEnd) {
      hitsByPos.set(pos, (hitsByPos.get(pos) ?? 0) + 1)
    }
  }
  let best = -1
  for (const [pos, n] of hitsByPos) {
    const depth = coverageDepths[Math.floor(pos - coverageStartPos)]
    if (depth && n / depth > threshold && (best < 0 || pos < best)) {
      best = pos
    }
  }
  return best < 0 ? undefined : best
}

// CONTROL. Byte-identical to the two above, declared separately on purpose.
const controlSnps = (
  position: number,
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  mismatchStrands: Int8Array,
) => {
  const snps: Record<string, { count: number; fwd: number; rev: number }> = {}
  for (let i = 0; i < mismatchPositions.length; i++) {
    if (mismatchPositions[i] === position) {
      const base = String.fromCharCode(mismatchBases[i]!)
      snps[base] ??= { count: 0, fwd: 0, rev: 0 }
      snps[base].count++
      if (mismatchStrands[i] === 1) {
        snps[base].fwd++
      } else if (mismatchStrands[i] === -1) {
        snps[base].rev++
      }
    }
  }
  return snps
}

const controlSignificant = (
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) => {
  const hitsByPos = new Map<number, number>()
  for (const pos of positions) {
    if (pos >= binStart && pos < binEnd) {
      hitsByPos.set(pos, (hitsByPos.get(pos) ?? 0) + 1)
    }
  }
  let best = -1
  for (const [pos, n] of hitsByPos) {
    const depth = coverageDepths[Math.floor(pos - coverageStartPos)]
    if (depth && n / depth > threshold && (best < 0 || pos < best)) {
      best = pos
    }
  }
  return best < 0 ? undefined : best
}

// THE PREVIOUS IMPLEMENTATION, transcribed: a READ-ORDER array plus the memoized
// side index. It is an arm rather than history because it is exactly what the
// sorted-producer path replaced, and reading the two against each other is the
// whole question now — the scan is no longer anyone's candidate.
const indexSnps = (
  position: number,
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  mismatchStrands: Int8Array,
) => {
  const snps: Record<string, { count: number; fwd: number; rev: number }> = {}
  const { order, sorted } = positionIndexFor(mismatchPositions)
  for (let k = lowerBound(sorted, position); k < sorted.length; k++) {
    if (sorted[k] !== position) {
      break
    }
    const i = order[k]!
    const base = String.fromCharCode(mismatchBases[i]!)
    snps[base] ??= { count: 0, fwd: 0, rev: 0 }
    snps[base].count++
    if (mismatchStrands[i] === 1) {
      snps[base].fwd++
    } else if (mismatchStrands[i] === -1) {
      snps[base].rev++
    }
  }
  return snps
}

const indexSignificant = (
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) => {
  const { sorted } = positionIndexFor(positions)
  let k = lowerBound(sorted, binStart)
  while (k < sorted.length && sorted[k]! < binEnd) {
    const pos = sorted[k]!
    let n = 0
    while (k < sorted.length && sorted[k] === pos) {
      n++
      k++
    }
    const depth = coverageDepths[Math.floor(pos - coverageStartPos)]
    if (depth && n / depth > threshold) {
      return pos
    }
  }
  return undefined
}

declare const gc: (() => void) | undefined

const FIXTURES = [
  { name: 'longread-400k', width: 200_000, mismatches: 400_000 },
  { name: 'shortread-40k', width: 200_000, mismatches: 40_000 },
  { name: 'deep-1m', width: 150_000, mismatches: 1_000_000 },
]

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const coverageStartPos = 1_000_000
  const rand = rng(9001)
  const depths = new Float32Array(fx.width)
  for (let i = 0; i < fx.width; i++) {
    depths[i] = 5 + Math.floor(rand() * 100)
  }
  // A fresh array per arm: the index memoizes against the array object, so the
  // scan arms must not be handed one that has already been indexed, and the
  // build arm needs an un-indexed array every round.
  const makePositions = () => {
    const out = new Uint32Array(fx.mismatches)
    const r = rng(4711)
    for (let i = 0; i < fx.mismatches; i++) {
      out[i] = coverageStartPos + Math.floor(r() * fx.width)
    }
    return out
  }
  const positions = makePositions()
  const bases = new Uint8Array(fx.mismatches)
  const strands = new Int8Array(fx.mismatches)
  const codes = [65, 67, 71, 84]
  for (let i = 0; i < fx.mismatches; i++) {
    bases[i] = codes[Math.floor(rand() * 4)]!
    strands[i] = rand() < 0.5 ? 1 : -1
  }
  const hoverAt = Array.from(
    { length: HOVERS },
    (_, h) => coverageStartPos + ((h * 7919) % fx.width),
  )

  // What the WORKER now ships: the same events, permuted into ascending position
  // order. The shipped readers take these; the two arms above take the read-order
  // arrays, which is the input they were written for.
  const permute = (src: Uint32Array) => {
    const { order, sorted } = positionOrder(src)
    const sBases = new Uint8Array(src.length)
    const sStrands = new Int8Array(src.length)
    for (let i = 0; i < src.length; i++) {
      sBases[i] = bases[order[i]!]!
      sStrands[i] = strands[order[i]!]!
    }
    return { sorted, sBases, sStrands }
  }
  const {
    sorted: sortedPositions,
    sBases: sortedBases,
    sStrands: sortedStrands,
  } = permute(positions)

  // Warm every arm the same way, then check the indexed answers match the scans
  // they replace — at every position this bench will hover.
  const fail = (msg: string) => {
    console.error(`  IDENTITY FAIL (${fx.name}): ${msg}`)
    if (!ALLOW_DIFF) {
      process.exit(1)
    }
  }
  // A sample of the hovered positions, not all of them: each check is two FULL
  // scans of the baseline arms over up to a million entries, which on the deep
  // fixture is most of the run's wall clock. Every arm is warmed on the same
  // sample, which is the property that matters.
  for (const p of hoverAt.slice(0, 40)) {
    const want = scanSnps(p, positions, bases, strands)
    controlSnps(p, positions, bases, strands)
    const gotIdx = indexSnps(p, positions, bases, strands)
    // The shipped reader, over the SORTED arrays it now requires. Handing it the
    // read-order array is not a weaker test, it is a meaningless one — a
    // `lowerBound` over unsorted input returns a plausible wrong answer, which
    // is exactly why the producers sort.
    const gotSorted = countSnpsAtPosition(p, {
      mismatchPositions: sortedPositions,
      mismatchBases: sortedBases,
      mismatchStrands: sortedStrands,
    })
    if (JSON.stringify(want) !== JSON.stringify(gotIdx)) {
      fail(
        `indexSnps(${p}): ${JSON.stringify(want)} vs ${JSON.stringify(gotIdx)}`,
      )
      break
    }
    if (JSON.stringify(want) !== JSON.stringify(gotSorted)) {
      fail(
        `countSnpsAtPosition(${p}): ${JSON.stringify(want)} vs ${JSON.stringify(gotSorted)}`,
      )
      break
    }
    const wantSig = scanSignificant(
      positions,
      depths,
      coverageStartPos,
      p,
      p + 20,
      0.05,
    )
    controlSignificant(positions, depths, coverageStartPos, p, p + 20, 0.05)
    const gotSigIdx = indexSignificant(
      positions,
      depths,
      coverageStartPos,
      p,
      p + 20,
      0.05,
    )
    const gotSigSorted = findSignificantInBin(
      sortedPositions,
      depths,
      coverageStartPos,
      p,
      p + 20,
      0.05,
    )
    if (wantSig !== gotSigIdx) {
      fail(`indexSignificant(${p}): ${wantSig} vs ${gotSigIdx}`)
      break
    }
    if (wantSig !== gotSigSorted) {
      fail(`findSignificantInBin(${p}): ${wantSig} vs ${gotSigSorted}`)
      break
    }
  }

  const ARMS = 4
  const best: Record<string, number> = {
    'scan-hover': Infinity,
    'index-hover': Infinity,
    'sorted-hover': Infinity,
    control: Infinity,
    'index-build': Infinity,
    'worker-sort': Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < ARMS; k++) {
      const which = (r + k) % ARMS
      const t = performance.now()
      if (which === 0) {
        for (const p of hoverAt) {
          scanSnps(p, positions, bases, strands)
          scanSignificant(positions, depths, coverageStartPos, p, p + 20, 0.05)
        }
      } else if (which === 1) {
        for (const p of hoverAt) {
          indexSnps(p, positions, bases, strands)
          indexSignificant(positions, depths, coverageStartPos, p, p + 20, 0.05)
        }
      } else if (which === 2) {
        for (const p of hoverAt) {
          countSnpsAtPosition(p, {
            mismatchPositions: sortedPositions,
            mismatchBases: sortedBases,
            mismatchStrands: sortedStrands,
          })
          findSignificantInBin(
            sortedPositions,
            depths,
            coverageStartPos,
            p,
            p + 20,
            0.05,
          )
        }
      } else {
        for (const p of hoverAt) {
          controlSnps(p, positions, bases, strands)
          controlSignificant(
            positions,
            depths,
            coverageStartPos,
            p,
            p + 20,
            0.05,
          )
        }
      }
      const ms = performance.now() - t
      const label =
        which === 0
          ? 'scan-hover'
          : which === 1
            ? 'index-hover'
            : which === 2
              ? 'sorted-hover'
              : 'control'
      best[label] = Math.min(best[label]!, ms)
    }

    // The two one-offs, each on an array nothing has touched yet.
    //
    // `index-build` is what the MAIN THREAD paid on the first hover after every
    // fetch, and is the cost the sorted producer deletes. `worker-sort` is what
    // replaced it, in the worker: the same sort plus permuting the parallel
    // arrays, which is strictly more work than the index build and is why it is
    // reported beside it rather than assumed free.
    gc?.()
    const cold = makePositions()
    let t = performance.now()
    indexSnps(hoverAt[0]!, cold, bases, strands)
    best['index-build'] = Math.min(best['index-build']!, performance.now() - t)

    gc?.()
    const cold2 = makePositions()
    t = performance.now()
    permute(cold2)
    best['worker-sort'] = Math.min(best['worker-sort']!, performance.now() - t)
  }

  console.log(`\n${fx.name}: ${fx.mismatches} mismatches over ${fx.width} bp`)
  const row = (label: string) => {
    console.log(
      `  ${label.padEnd(13)} ${best[label]!.toFixed(2).padStart(8)} ms  ${(best['scan-hover']! / best[label]!).toFixed(2)}x`,
    )
  }
  row('scan-hover')
  row('index-hover')
  row('sorted-hover')
  row('control')
  console.log(
    `  ${'index-build'.padEnd(13)} ${best['index-build']!.toFixed(2).padStart(8)} ms  (was: main thread, first hover after each fetch)`,
  )
  console.log(
    `  ${'worker-sort'.padEnd(13)} ${best['worker-sort']!.toFixed(2).padStart(8)} ms  (now: worker, once per fetch)`,
  )
}
