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
//   longread-400k   scan  626.2  index 0.21  sorted 0.17  [0.47]  build  4.53  sort 10.29
//                   scan  647.6  index 0.22  sorted 0.17  [0.48]  build  4.48  sort 10.26
//                   scan  694.9  index 0.22  sorted 0.17  [1.00]  build  4.40  sort 10.38
//   shortread-40k   scan   60.4  index 0.10  sorted 0.08  [0.99]  build  0.61  sort  0.88
//                   scan   62.2  index 0.10  sorted 0.08  [1.00]  build  0.64  sort  0.94
//                   scan   66.2  index 0.10  sorted 0.09  [1.00]  build  0.66  sort  0.96
//   deep-1m         scan 1487.2  index 0.32  sorted 0.22  [0.99]  build 10.12  sort 21.06
//                   scan 1465.0  index 0.31  sorted 0.22  [1.00]  build  9.63  sort 20.26
//                   scan 1505.1  index 0.33  sorted 0.22  [1.00]  build 10.33  sort 20.65
//
// SEVEN OF NINE ROWS hold their control at 0.99-1.00. The two that don't are
// longread-400k's first two samples at 0.47/0.48, and the third sample says which
// arm was at fault: there both arms land at ~695ms, so the earlier pairs were the
// CONTROL running slow (1342ms, 1347ms) rather than the scan running fast. That
// fixture's absolute scan time swings between ~630 and ~1345ms under contention on
// this box; the columns that matter here do not move with it.
//
// **`worker-sort` was corrected UPWARD here and the old figure should not be
// quoted.** The fixture permuted two parallel arrays where `buildMismatchArrays`
// permutes four, so the one-off was reported ~40% under what the producer pays:
// 14.7ms became 21.1ms on deep-1m, 7.4 became 10.3 on longread. It is measured in
// its own timed block outside the arm rotation, which is why it stays stable
// (20.3-21.1ms across three samples) while the scan column swings.
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
// THE ONE-OFF MOVED AND GREW, and both halves matter. `worker-sort` is 1.4-2.3x
// `index-build` (21.1 vs 10.1ms on deep-1m, 10.3 vs 4.4 on longread) because it
// permutes four parallel arrays as well as sorting, where the index only built
// `order` and `sorted`. But `index-build` ran on the MAIN THREAD, on the first
// mousemove after every fetch, and `worker-sort` runs in the worker beside work
// already O(n) — so the interaction path lost a 10ms stall and gained nothing.
// Against the scan it replaces (1487ms over 200 hovers) either is paid back within
// two pointer motions.
//
// ---------------------------------------------------------------------------
// WHAT THE "SORT" ACTUALLY IS, because sorting is the expensive operation this
// looks like and is not one here.
//
// Sorted: the per-mismatch EVENTS, keyed on genomic position. `n` is the mismatch
// count in the region (400k, 1M) and the key space is the region WIDTH in bp
// (200k, 150k). So `span/n` is **0.15 to 0.50** — there are two to seven times
// more events than distinct keys they can take. The key space is smaller than the
// data, which is the precondition for a counting sort, and it holds structurally
// rather than by luck: a pileup is many reads deep over one window.
//
// `positionOrder` is therefore O(n + span): tally per bp, prefix-sum into starting
// offsets, scatter. Decomposed on the deep-1m shape (15 rounds, min):
//
//   min/max scan          4.6 ms   21%
//   tally (n increments)  4.8 ms   21%
//   prefix sum (span)     0.2 ms    1%   <- span < n, so this is nearly free
//   scatter (n writes)    9.0 ms   40%   (cumulative with the two above)
//   ---------------------------------
//   positionOrder        10.8 ms   48%
//   permute 4 arrays     22.5 ms  100%   <- the permutation is over HALF the cost
//
// So the sort is not the expensive half; carrying the four parallel arrays through
// it is. And the comparison sorts a reader would assume were meant are the thing
// to avoid, measured on the same fixture:
//
//   comparator on indices   409 ms    38x the counting sort
//   comparator on objects   440 ms    41x
//
// That 38-41x is why `positionOrder` exists rather than an `idx.sort((a, b) => …)`
// at each call site — a per-compare JS callback over a million entries is exactly
// the "sorting is slow" intuition, and it is correct. It is also why the SPARSE
// fallback inside `positionOrder` matters: when `span` is large relative to `n`
// the counting sort's advantage inverts and a bp-indexed histogram would allocate
// hundreds of megabytes to order a handful of events, so that branch takes the
// comparison sort deliberately, where n is small enough for it to be cheap.
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
  // Not read by any hover arm — these two are the rest of what the producer
  // permutes, and exist so `worker-sort` prices the real thing.
  const readIndices = new Uint32Array(fx.mismatches)
  const quals = new Uint8Array(fx.mismatches)
  const codes = [65, 67, 71, 84]
  for (let i = 0; i < fx.mismatches; i++) {
    bases[i] = codes[Math.floor(rand() * 4)]!
    strands[i] = rand() < 0.5 ? 1 : -1
    readIndices[i] = i >> 3
    quals[i] = 30 + (i % 10)
  }
  const hoverAt = Array.from(
    { length: HOVERS },
    (_, h) => coverageStartPos + ((h * 7919) % fx.width),
  )

  // What the WORKER now ships: the same events, permuted into ascending position
  // order. The shipped readers take these; the two arms above take the read-order
  // arrays, which is the input they were written for.
  // Carries ALL FOUR parallel arrays `buildMismatchArrays` permutes — bases,
  // strands, readIndices, quals — not just the two the hover arms read. The
  // permutation is over half of `worker-sort`, more than the sort itself, so a
  // version carrying two arrays reported that one-off roughly 40% under what the
  // producer actually pays. The hover arms use only `sorted`/`sBases`/`sStrands`;
  // the other two exist so the timing is honest.
  const permute = (src: Uint32Array) => {
    const { order, sorted } = positionOrder(src)
    const sBases = new Uint8Array(src.length)
    const sStrands = new Int8Array(src.length)
    const sReadIdx = new Uint32Array(src.length)
    const sQuals = new Uint8Array(src.length)
    for (let i = 0; i < src.length; i++) {
      const j = order[i]!
      sBases[i] = bases[j]!
      sStrands[i] = strands[j]!
      sReadIdx[i] = readIndices[j]!
      sQuals[i] = quals[j]!
    }
    return { sorted, sBases, sStrands, sReadIdx, sQuals }
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
