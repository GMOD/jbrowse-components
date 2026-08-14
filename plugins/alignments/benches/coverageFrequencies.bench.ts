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
//   map        what shipped before
//   lanes      what ships now (transcribed; pinned to the shipped fn by the
//              identity check)
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
// WHAT IT SAYS. Two samples, --rounds=50, control in brackets:
//
//   longread-dense             5.54x [0.93], 5.45x [0.97]   75 -> 14 ms
//   shortread-sparse-density   3.80x [0.98], 3.37x [1.02]
//   wide-window-few-events     4.18x [1.00], 4.08x [1.01]
//   with-iupac                 3.85x [0.98], 3.70x [0.99]
//
// The dense long-read row is the one to read: 75ms -> 14ms per fetch, per track,
// on a path no display setting turns off. Six BAM tracks in one view pay it six
// times.
//
// `with-iupac` is there to price the fallback rather than assume it away: 2% of
// bases outside ACGTN still runs at 3.7x, because the Map it falls back to then
// holds 2% of the entries rather than all of them.

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
  for (let i = 0; i < fx.mismatches; i++) {
    positions[i] = coverageStartPos + Math.floor(rand() * span)
    bases[i] =
      rand() < fx.iupacRate
        ? iupac[Math.floor(rand() * iupac.length)]!
        : acgtn[Math.floor(rand() * 5)]!
  }

  // Warm every arm the same way, then check identity — including against the
  // shipped function, which is what ties the `lanes` arm to the code under test.
  const a = freqMap(positions, bases, depths, coverageStartPos)
  const b = freqLanes(positions, bases, depths, coverageStartPos)
  const c = freqControl(positions, bases, depths, coverageStartPos)
  check(fx.name, a, b)
  check(`${fx.name} control`, a, c)
  check(
    `${fx.name} shipped`,
    a,
    computeMismatchFrequencies(positions, bases, depths, coverageStartPos),
  )

  const best: Record<string, number> = {
    map: Infinity,
    lanes: Infinity,
    control: Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < 3; k++) {
      const which = (r + k) % 3
      const t = performance.now()
      if (which === 0) {
        freqMap(positions, bases, depths, coverageStartPos)
      } else if (which === 1) {
        freqLanes(positions, bases, depths, coverageStartPos)
      } else {
        freqControl(positions, bases, depths, coverageStartPos)
      }
      const ms = performance.now() - t
      const label = which === 0 ? 'map' : which === 1 ? 'lanes' : 'control'
      best[label] = Math.min(best[label]!, ms)
    }
  }
  console.log(
    `\n${fx.name}: ${fx.windowLength} bins, ${fx.mismatches} mismatches over ${span} bp`,
  )
  for (const label of ['map', 'lanes', 'control']) {
    console.log(
      `  ${label.padEnd(9)} ${best[label]!.toFixed(2).padStart(8)} ms  ${(best.map! / best[label]!).toFixed(2)}x`,
    )
  }
}
