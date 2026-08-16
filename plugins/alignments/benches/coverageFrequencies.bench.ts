// What does the per-mismatch frequency pass cost, keyed by a Map vs a flat lane
// array?
//
//   node --expose-gc plugins/alignments/benches/coverageFrequencies.bench.ts
//
// Flags: --rounds=<n> (default 50), --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. `computeMismatchFrequencies` counts each (position, base) pair
// and then divides by the depth there, which was a `Map` keyed by
// `position * 256 + base`: two hash operations per mismatch, over an array that
// on a long-read pileup holds hundreds of thousands of them. `computeSNPCoverage`
// already measured that exact substitution at 2.9x on its own count pass — but
// it is the COLDER of the two, since the SNP segments are built only when the
// coverage band is drawn while these frequencies feed the pileup's mismatch fade
// and are computed before that gate on every fetch.
//
// The flat array is sized by the SPAN the mismatches occupy rather than by the
// window, which is what keeps it from trading a Map sized by the data for an
// array sized by the region — the `sparse` fixture is that case.
//
// ARMS:
//   map        the first shape
//   lanes      what ships now: flat lanes over the mismatch span, Map for the
//              rest (transcribed; pinned to the shipped fn by the identity
//              check)
//   run-walk   REJECTED. The mismatches arrive ascending, so the entries at one
//              position are contiguous and five scratch counters would group
//              them with no span pass, no lane array and no Map. Kept as an arm
//              because the idea keeps looking right on paper
//   control    a second, separately-declared copy of `map`. A row whose control
//              is far from 1.00 measured nothing.
//
// Each arm is its own function literal with its own call site, and the round
// order rotates, for the reasons the rule list gives.
//
// SYNTHETIC FIXTURES — pure functions over typed arrays, so what the inputs have
// to get right is the shape: window width, mismatch count, how many distinct
// positions they land on.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Against `map`, --rounds=50, control in brackets:
//
//                              lanes           run-walk
//   longread-dense             6.15-6.99x      5.05-5.68x   [0.94-0.99]
//   shortread-sparse-density   4.16x           4.66x        [0.98]
//   wide-window-few-events     4.45x           4.41x        [1.01]
//   with-iupac                 4.60-5.98x      3.11-3.96x   [1.00-1.02]
//
// The dense long-read row is the one to read: 68ms -> 10ms per fetch, per track,
// on a path no display setting turns off. Six BAM tracks in one view pay it six
// times.
//
// AND IT IS WHY `run-walk` IS NOT THE SHIPPED ARM, against the reading that a
// contiguous-run group must beat an indexed one because it allocates nothing.
// It loses the two rows that matter — 0.81x on longread-dense, 0.68x on
// with-iupac — and the reason is the run LENGTH. 400k mismatches over 200k
// positions is runs of two: the run-boundary compare and the second walk of
// each run cost more than the lane array's single indexed bump, and the lane
// array is already sized by the mismatches' SPAN rather than the region, so
// there is no window-sized allocation left to delete. (`computeSNPCoverage` is
// the opposite case and does run-walk: its array was window-sized, and it emits
// per POSITION rather than per mismatch, so the run structure is work it needs
// anyway.)
//
// `with-iupac` is there to price the fallback rather than assume it away: 2% of
// bases outside ACGTN still runs at 4.6x+, because the Map it falls back to
// then holds 2% of the entries rather than all of them. The same 2% is what
// costs `run-walk` most, since its fallback rescans the run per entry.

import { computeMismatchFrequencies } from '../src/shared/computeFrequenciesAndThresholds.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const ROUNDS = Number(arg('rounds', '50'))
const ONLY = arg('only', '')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// BASELINE. Map keyed by position * 256 + base, two hash ops per mismatch.
const freqMap = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) => {
  const n = mismatchPositions.length
  const frequencies = new Uint8Array(n)
  const posBaseCounts = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const key = mismatchPositions[i]! * 256 + mismatchBases[i]!
    posBaseCounts.set(key, (posBaseCounts.get(key) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const pos = mismatchPositions[i]!
    const idx = pos - coverageStartPos
    const depth =
      idx >= 0 && idx < coverageDepths.length ? coverageDepths[idx]! : 1
    const key = pos * 256 + mismatchBases[i]!
    const count = posBaseCounts.get(key) ?? 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

// CONTROL. Byte-identical to freqMap, separate literal on purpose.
const freqControl = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) => {
  const n = mismatchPositions.length
  const frequencies = new Uint8Array(n)
  const posBaseCounts = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const key = mismatchPositions[i]! * 256 + mismatchBases[i]!
    posBaseCounts.set(key, (posBaseCounts.get(key) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const pos = mismatchPositions[i]!
    const idx = pos - coverageStartPos
    const depth =
      idx >= 0 && idx < coverageDepths.length ? coverageDepths[idx]! : 1
    const key = pos * 256 + mismatchBases[i]!
    const count = posBaseCounts.get(key) ?? 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

const LANE = new Int8Array(256).fill(-1)
LANE[65] = 0
LANE[67] = 1
LANE[71] = 2
LANE[84] = 3
LANE[78] = 4

// NEW. Flat lanes over the mismatch span, Map only for the rare cases.
const freqLanes = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) => {
  const n = mismatchPositions.length
  const frequencies = new Uint8Array(n)
  const windowLength = coverageDepths.length
  let min = windowLength
  let max = -1
  for (let i = 0; i < n; i++) {
    const offset = mismatchPositions[i]! - coverageStartPos
    if (offset >= 0 && offset < windowLength) {
      if (offset < min) {
        min = offset
      }
      if (offset > max) {
        max = offset
      }
    }
  }
  const span = max < min ? 0 : max - min + 1
  const counts = new Uint32Array(span * 5)
  let rare: Map<number, number> | undefined
  for (let i = 0; i < n; i++) {
    const offset = mismatchPositions[i]! - coverageStartPos
    const lane = LANE[mismatchBases[i]!]!
    if (lane >= 0 && offset >= 0 && offset < windowLength) {
      counts[(offset - min) * 5 + lane]!++
    } else {
      const key = mismatchPositions[i]! * 256 + mismatchBases[i]!
      rare ??= new Map()
      rare.set(key, (rare.get(key) ?? 0) + 1)
    }
  }
  for (let i = 0; i < n; i++) {
    const pos = mismatchPositions[i]!
    const offset = pos - coverageStartPos
    const lane = LANE[mismatchBases[i]!]!
    const inWindow = offset >= 0 && offset < windowLength
    const count =
      lane >= 0 && inWindow
        ? counts[(offset - min) * 5 + lane]!
        : (rare?.get(pos * 256 + mismatchBases[i]!) ?? 1)
    const depth = inWindow ? coverageDepths[offset]! : 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

// NEW. Run-walk over the ascending positions: five scratch counters, no per-bp
// structure and no keyed lookup. The non-ACGTN bases rescan their own run.
const freqRunWalk = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) => {
  const n = mismatchPositions.length
  const frequencies = new Uint8Array(n)
  const windowLength = coverageDepths.length
  const counts = new Uint32Array(5)
  let i = 0
  while (i < n) {
    const position = mismatchPositions[i]!
    const offset = position - coverageStartPos
    const inWindow = offset >= 0 && offset < windowLength
    const depth = inWindow ? coverageDepths[offset]! : 1
    const start = i
    while (i < n && mismatchPositions[i] === position) {
      const lane = LANE[mismatchBases[i]!]!
      if (lane >= 0) {
        counts[lane]!++
      }
      i++
    }
    for (let j = start; j < i; j++) {
      const lane = LANE[mismatchBases[j]!]!
      let count = 0
      if (lane >= 0) {
        count = counts[lane]!
      } else {
        const base = mismatchBases[j]!
        for (let k = start; k < i; k++) {
          if (mismatchBases[k] === base) {
            count++
          }
        }
      }
      const freq = depth > 0 ? count / depth : 0
      frequencies[j] = Math.min(255, Math.round(freq * 255))
    }
    counts[0] = 0
    counts[1] = 0
    counts[2] = 0
    counts[3] = 0
    counts[4] = 0
  }
  return frequencies
}

function check(name: string, a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    console.error(
      `  IDENTITY FAIL (${name}): length ${a.length} vs ${b.length}`,
    )
    if (!ALLOW_DIFF) {
      process.exit(1)
    }
    return
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      console.error(`  IDENTITY FAIL (${name}): [${i}] ${a[i]} vs ${b[i]}`)
      if (!ALLOW_DIFF) {
        process.exit(1)
      }
      return
    }
  }
}

declare const gc: (() => void) | undefined

const FIXTURES = [
  {
    // Long-read pileup: a high error rate over a window the reads cover fully.
    name: 'longread-dense',
    windowLength: 200_000,
    mismatches: 400_000,
    spanFrac: 1,
    iupacRate: 0,
  },
  {
    // Short reads, a much lower mismatch rate — closer to a real SNP density.
    name: 'shortread-sparse-density',
    windowLength: 200_000,
    mismatches: 40_000,
    spanFrac: 1,
    iupacRate: 0,
  },
  {
    // Few events in a wide window: what the span sizing is for. A synteny block
    // reaches this function ungated by showCoverage.
    name: 'wide-window-few-events',
    windowLength: 2_000_000,
    mismatches: 20_000,
    spanFrac: 0.01,
    iupacRate: 0,
  },
  {
    // 2% of bases outside ACGTN, so the rare-Map fallback is actually taken.
    name: 'with-iupac',
    windowLength: 200_000,
    mismatches: 200_000,
    spanFrac: 1,
    iupacRate: 0.02,
  },
]

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const coverageStartPos = 1_000_000
  const rand = rng(4242)
  const depths = new Float32Array(fx.windowLength)
  for (let i = 0; i < fx.windowLength; i++) {
    depths[i] = Math.floor(rand() * 120)
  }
  const span = Math.floor(fx.windowLength * fx.spanFrac)
  const positions = new Uint32Array(fx.mismatches)
  const bases = new Uint8Array(fx.mismatches)
  const acgtn = [65, 67, 71, 84, 78]
  const iupac = [77, 82, 83, 86, 87, 89, 72, 75, 68, 66]
  const drawn = Array.from({ length: fx.mismatches }, () => ({
    position: coverageStartPos + Math.floor(rand() * span),
    base:
      rand() < fx.iupacRate
        ? iupac[Math.floor(rand() * iupac.length)]!
        : acgtn[Math.floor(rand() * 5)]!,
  }))
  // Ascending, which is the shipped function's input contract and what the
  // run-walk arm needs. The other two arms are order-insensitive, so sorting
  // here costs them nothing and keeps every arm on one fixture.
  drawn.sort((a, b) => a.position - b.position)
  for (let i = 0; i < fx.mismatches; i++) {
    positions[i] = drawn[i]!.position
    bases[i] = drawn[i]!.base
  }

  // Warm every arm the same way, then check identity — including against the
  // shipped function, which is what ties the `lanes` arm to the code under test.
  const a = freqMap(positions, bases, depths, coverageStartPos)
  const b = freqLanes(positions, bases, depths, coverageStartPos)
  const c = freqControl(positions, bases, depths, coverageStartPos)
  const d = freqRunWalk(positions, bases, depths, coverageStartPos)
  check(fx.name, a, b)
  check(`${fx.name} control`, a, c)
  check(`${fx.name} run-walk`, a, d)
  check(
    `${fx.name} shipped`,
    a,
    computeMismatchFrequencies(positions, bases, depths, coverageStartPos),
  )

  const ARMS = ['map', 'lanes', 'run-walk', 'control'] as const
  const best: Record<string, number> = {
    map: Infinity,
    lanes: Infinity,
    'run-walk': Infinity,
    control: Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < ARMS.length; k++) {
      const which = (r + k) % ARMS.length
      const t = performance.now()
      if (which === 0) {
        freqMap(positions, bases, depths, coverageStartPos)
      } else if (which === 1) {
        freqLanes(positions, bases, depths, coverageStartPos)
      } else if (which === 2) {
        freqRunWalk(positions, bases, depths, coverageStartPos)
      } else {
        freqControl(positions, bases, depths, coverageStartPos)
      }
      const ms = performance.now() - t
      const label = ARMS[which]!
      best[label] = Math.min(best[label]!, ms)
    }
  }
  console.log(
    `\n${fx.name}: ${fx.windowLength} bins, ${fx.mismatches} mismatches over ${span} bp`,
  )
  for (const label of ARMS) {
    console.log(
      `  ${label.padEnd(9)} ${best[label]!.toFixed(2).padStart(8)} ms  ${(best.map! / best[label]!).toFixed(2)}x`,
    )
  }
}
