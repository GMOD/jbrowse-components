// What does a hover over the coverage band cost, scanning versus indexed?
//
//   node --expose-gc packages/alignments-core/benches/hoverIndex.bench.ts
//
// Flags: --rounds=<n> (default 25), --hovers=<n> (default 200),
//        --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. The per-event arrays the worker ships arrive in READ order, so
// every per-hover reader of them scanned the whole array to find the entries
// under the cursor. A hover is a mousemove, and the coverage band fires two of
// these readers per motion (`findSignificantInBin` from the hit test, then
// `countSnpsAtPosition` from the tooltip) per block, per stacked BAM track.
//
// TWO COSTS, and the second is why this bench exists at all:
//
//   hover  — the per-mousemove work, which is what the index removes
//   build  — sorting the array once, which the index ADDS, on the first hover
//            after each fetch
//
// A structure that turns a 3ms scan into a 200ms sort has made the thing worse
// at the moment a user first touches the band. That is the number to look at
// before the ratio, and it is why the build is a counting sort over the
// position span rather than a comparison sort.
//
// ARMS:
//   scan-hover / index-hover   the per-hover work, both ways
//   index-build                the one-off, reported in the same units so it
//                              can be read against the scan it replaces
//   control                    a second, separately-declared copy of
//                              scan-hover. A row whose control is far from 1.00
//                              measured nothing.
//
// SYNTHETIC FIXTURES: mismatch arrays the size a pileup ships, in read order
// (shuffled), over a window the width of a fetched block.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. --rounds=25 --hovers=200, ms per 200 hovers, control in
// brackets:
//
//   longread-400k    scan 758.0   index 0.28   2670x [0.94]   build  5.7 ms
//   shortread-40k    scan  85.8   index 0.14    621x [1.01]   build  0.8 ms
//   deep-1m          scan 2249.9  index 0.46   4876x [0.97]   build 17.4 ms
//
// Per single mousemove on the deep fixture that is 11.2ms -> 0.002ms, in ONE
// block of ONE track; the view this branch is about stacks six.
//
// Read the build column against the SCAN column, not against the index one: on
// the 1M fixture the sort costs 17ms once and the scan it replaces cost 2250ms
// over 200 hovers, so the index has paid for itself within the first two
// pointer motions and every hover after that is free. The counting sort is what
// makes that true — it is O(n + span) where the span is the block width, so the
// first hover after a fetch does not stall.
//
// The ratios here are far larger than "one scan replaced by one binary search"
// suggests because a hover fires BOTH readers, and the baseline's
// `findSignificantInBin` also allocated a Map while it scanned.

import {
  countSnpsAtPosition,
  findSignificantInBin,
} from '../src/coverageDownsampling.ts'

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
    const got = countSnpsAtPosition(p, {
      mismatchPositions: positions,
      mismatchBases: bases,
      mismatchStrands: strands,
    })
    if (JSON.stringify(want) !== JSON.stringify(got)) {
      fail(
        `countSnpsAtPosition(${p}): ${JSON.stringify(want)} vs ${JSON.stringify(got)}`,
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
    const gotSig = findSignificantInBin(
      positions,
      depths,
      coverageStartPos,
      p,
      p + 20,
      0.05,
    )
    if (wantSig !== gotSig) {
      fail(`findSignificantInBin(${p}): ${wantSig} vs ${gotSig}`)
      break
    }
  }

  const best: Record<string, number> = {
    'scan-hover': Infinity,
    'index-hover': Infinity,
    control: Infinity,
    'index-build': Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < 3; k++) {
      const which = (r + k) % 3
      const t = performance.now()
      if (which === 0) {
        for (const p of hoverAt) {
          scanSnps(p, positions, bases, strands)
          scanSignificant(positions, depths, coverageStartPos, p, p + 20, 0.05)
        }
      } else if (which === 1) {
        for (const p of hoverAt) {
          countSnpsAtPosition(p, {
            mismatchPositions: positions,
            mismatchBases: bases,
            mismatchStrands: strands,
          })
          findSignificantInBin(
            positions,
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
        which === 0 ? 'scan-hover' : which === 1 ? 'index-hover' : 'control'
      best[label] = Math.min(best[label]!, ms)
    }

    // The one-off, on an array no one has indexed yet — which is the state
    // every fetch leaves the main thread in.
    gc?.()
    const cold = makePositions()
    const t = performance.now()
    countSnpsAtPosition(hoverAt[0]!, {
      mismatchPositions: cold,
      mismatchBases: bases,
      mismatchStrands: strands,
    })
    best['index-build'] = Math.min(best['index-build']!, performance.now() - t)
  }

  console.log(`\n${fx.name}: ${fx.mismatches} mismatches over ${fx.width} bp`)
  const row = (label: string) => {
    console.log(
      `  ${label.padEnd(13)} ${best[label]!.toFixed(2).padStart(8)} ms  ${(best['scan-hover']! / best[label]!).toFixed(2)}x`,
    )
  }
  row('scan-hover')
  row('index-hover')
  row('control')
  console.log(
    `  ${'index-build'.padEnd(13)} ${best['index-build']!.toFixed(2).padStart(8)} ms  (once per fetch)`,
  )
}
