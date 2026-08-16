// What do the coverage band's two O(region) passes cost, and what does bounding
// them to the data buy?
//
//   node --expose-gc packages/alignments-core/benches/coverageBand.bench.ts
//
// Flags: --rounds=<n> (default 40), --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — and the traps they exist for are in
// `agent-docs/reference/BENCHMARKING.md`. Read that before changing this.
//
// TWO QUESTIONS, one per section.
//
// **The depth sweep.** `computeCoverage` fills three depth arrays: total, fwd
// and rev. They differ only in which reads they skip, and were three calls to
// one `sweepDepths(…, wantStrand)` — i.e. the read array walked three times to
// vary a predicate. The per-strand pair backs the coverage tooltip's strand
// breakdown and is on by default with the band, so a deep short-read window
// paid two extra full walks of every read on every fetch.
//
// **The SNP segment build.** `computeSNPCoverage` used to count mismatches into
// a flat per-bp lane array — `new Uint32Array(windowLength * 5)`, 20 bytes per
// bp of the coverage window — and then walk the window to fill the output.
// Both the allocation and the walk cost the region's width no matter how few
// mismatches are in it, which is the regime a zoomed-out pileup and every MAF
// region are in. The mismatches arrive ascending, so the lane array is not
// needed at all: equal positions are contiguous and five scratch counters group
// them.
//
// ARMS, and why each is declared longhand here rather than imported:
//   three-pass / window-scan   the first shape: bucket, size by scanning the
//                              window, fill by scanning it again
//   one-pass / data-bound      the second: size off the mismatch walk, and
//                              bound the fill to [minOffset, maxOffset]
//   run-walk                   what ships now: no per-bp structure
//   control                    a second, separately-declared copy of the
//                              baseline. Whatever it scores is what this
//                              machine could resolve; a row whose control is
//                              far from 1.00 measured nothing.
//
// Every arm is a local function literal with its own longhand driver: separate
// literals is what gives separate inline caches, and an imported arm beside a
// local one would be inlinable where the other is not. The shipped
// implementations are imported anyway — but only for the IDENTITY check, which
// is what ties the "new" arm here to the code under test.
//
// SYNTHETIC FIXTURES. These are pure functions over plain arrays and typed
// arrays, so the inputs are generated rather than read out of a BAM: what they
// have to get right is the SHAPE (region width, read length, depth, mismatch
// rate, how the mismatches are spread), and that is stated per fixture below.
// The one thing a real file would add is allocation history, which the rotation
// and the control are there to absorb.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Two samples, --rounds=60, control in brackets:
//
//   depth sweep, shortread-300x     2.20x [1.02], 2.51x [1.00]
//   depth sweep, longread-60x       1.00x [0.81], 3.13x [2.69]   -- see below
//   snp segments, dense-spread      1.07x [0.99], 1.10x [0.99]
//   snp segments, sparse-clustered  24.1x [0.99], 35.9x [1.01]
//
// The long-read row measured NOTHING and is kept to say so: its control is 0.81
// and then 2.69, i.e. the harness could not resolve that fixture at all. That
// is the expected shape rather than a harness bug — 800 reads against 215k bins
// means three prefix sums, not the read walk, are the whole cost, so there is
// no win there to find and the rounds are short enough (~2ms) that scheduling
// noise swamps them. The win is in the read count, and the short-read row is
// where the read count is.
//
// The two SNP rows are the two regimes, and only one of them separates the
// arms. dense-spread puts 300k mismatches over 200k bins, so the lane array is
// nearly full and the runs are 1.5 long — every arm walks the same span, and
// the three non-baseline arms swap places run to run inside a spread the
// control shows is noise. Don't read a winner off that row. sparse-clustered is
// the regime every zoomed-out pileup and every MAF region is in, and there the
// window-sized allocation IS the cost: run-walk is ~2.5x data-bound and never
// allocates the 10 MB.

import { computeCoverage } from '../src/coverageCompute.ts'
import { computeSNPCoverage } from '../src/snpCoverage.ts'
import { readSnpSegments } from '../src/snpSegments.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const ONLY = arg('only', '')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

// ---------------------------------------------------------------------------
// fixtures

interface Feat {
  start: number
  end: number
  strand?: number
}
interface Gap {
  start: number
  end: number
  type: 'deletion' | 'skip'
  strand: number
  featureStrand: number
}

// Deterministic PRNG so every round and every arm sees the identical input.
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function makeReads(
  regionStart: number,
  regionEnd: number,
  readLength: number,
  depth: number,
  gapRate: number,
  seed: number,
) {
  const rand = rng(seed)
  const width = regionEnd - regionStart
  const count = Math.round((width * depth) / readLength)
  const features: Feat[] = []
  const gaps: Gap[] = []
  for (let i = 0; i < count; i++) {
    // Reads start anywhere in the window, including left of it, so the
    // overhang clamps get exercised the way a real fetch exercises them.
    const start =
      regionStart - readLength + Math.floor(rand() * (width + readLength))
    const end = start + readLength
    const strand = rand() < 0.5 ? 1 : -1
    features.push({ start, end, strand })
    if (rand() < gapRate) {
      const gs = start + Math.floor(rand() * readLength * 0.8)
      const len = 1 + Math.floor(rand() * 30)
      gaps.push({
        start: gs,
        end: gs + len,
        type: 'deletion',
        strand,
        featureStrand: strand,
      })
    }
  }
  return { features, gaps }
}

function makeMismatches(
  spanStart: number,
  spanEnd: number,
  count: number,
  seed: number,
) {
  const rand = rng(seed)
  const drawn = Array.from({ length: count }, () => ({
    position: spanStart + Math.floor(rand() * (spanEnd - spanStart)),
    base: [65, 67, 71, 84, 78][Math.floor(rand() * 5)]!,
  }))
  // Ascending, which is `computeSNPCoverage`'s input contract and what the
  // run-walk arm needs. The two window-scan arms are order-insensitive, so
  // sorting here costs them nothing and keeps every arm on one fixture.
  drawn.sort((a, b) => a.position - b.position)
  const positions = new Uint32Array(count)
  const bases = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    positions[i] = drawn[i]!.position
    bases[i] = drawn[i]!.base
  }
  return { positions, bases }
}

// ---------------------------------------------------------------------------
// depth sweep: three arms, each a separate function literal

// BASELINE. One diff array per call, three calls, a `wantStrand` predicate per
// read per call.
const sweepThreePass = (
  features: Feat[],
  gaps: Gap[],
  numBins: number,
  actualStart: number,
  trackStrands: boolean,
) => {
  const one = (wantStrand: number) => {
    const depths = new Float32Array(numBins)
    for (const f of features) {
      const strand = f.strand ?? 0
      if (wantStrand === 0 || strand === 0 || strand === wantStrand) {
        const s = f.start - actualStart
        const e = f.end - actualStart
        if (s < numBins && e > 0) {
          depths[s > 0 ? s : 0]! += 1
          if (e < numBins) {
            depths[e]! -= 1
          }
        }
      }
    }
    for (const g of gaps) {
      const strand = g.featureStrand
      if (wantStrand === 0 || strand === 0 || strand === wantStrand) {
        const s = g.start - actualStart
        const e = g.end - actualStart
        if (s < numBins && e > 0) {
          depths[s > 0 ? s : 0]! -= 1
          if (e < numBins) {
            depths[e]! += 1
          }
        }
      }
    }
    let acc = 0
    for (let i = 0; i < numBins; i++) {
      acc += depths[i]!
      depths[i] = acc > 0 ? acc : 0
    }
    return depths
  }
  const depths = one(0)
  return {
    depths,
    fwdDepths: trackStrands ? one(1) : undefined,
    revDepths: trackStrands ? one(-1) : undefined,
  }
}

// CONTROL. Byte-identical to sweepThreePass, declared separately so it gets its
// own inline caches. The duplication is deliberate.
const sweepControl = (
  features: Feat[],
  gaps: Gap[],
  numBins: number,
  actualStart: number,
  trackStrands: boolean,
) => {
  const one = (wantStrand: number) => {
    const depths = new Float32Array(numBins)
    for (const f of features) {
      const strand = f.strand ?? 0
      if (wantStrand === 0 || strand === 0 || strand === wantStrand) {
        const s = f.start - actualStart
        const e = f.end - actualStart
        if (s < numBins && e > 0) {
          depths[s > 0 ? s : 0]! += 1
          if (e < numBins) {
            depths[e]! -= 1
          }
        }
      }
    }
    for (const g of gaps) {
      const strand = g.featureStrand
      if (wantStrand === 0 || strand === 0 || strand === wantStrand) {
        const s = g.start - actualStart
        const e = g.end - actualStart
        if (s < numBins && e > 0) {
          depths[s > 0 ? s : 0]! -= 1
          if (e < numBins) {
            depths[e]! += 1
          }
        }
      }
    }
    let acc = 0
    for (let i = 0; i < numBins; i++) {
      acc += depths[i]!
      depths[i] = acc > 0 ? acc : 0
    }
    return depths
  }
  const depths = one(0)
  return {
    depths,
    fwdDepths: trackStrands ? one(1) : undefined,
    revDepths: trackStrands ? one(-1) : undefined,
  }
}

// NEW. One walk of the reads filling all three diff arrays, then a prefix sum
// each. A transcription of what `coverageCompute.ts` now ships — pinned to it
// by the identity check.
const sweepOnePass = (
  features: Feat[],
  gaps: Gap[],
  numBins: number,
  actualStart: number,
  trackStrands: boolean,
) => {
  const bump = (diff: Float32Array, lo: number, end: number, delta: number) => {
    diff[lo]! += delta
    if (end < numBins) {
      diff[end]! -= delta
    }
  }
  const depths = new Float32Array(numBins)
  const fwdDepths = trackStrands ? new Float32Array(numBins) : undefined
  const revDepths = trackStrands ? new Float32Array(numBins) : undefined
  for (const f of features) {
    const s = f.start - actualStart
    const e = f.end - actualStart
    if (s < numBins && e > 0) {
      const lo = s > 0 ? s : 0
      const strand = f.strand ?? 0
      bump(depths, lo, e, 1)
      if (fwdDepths && (strand === 0 || strand === 1)) {
        bump(fwdDepths, lo, e, 1)
      }
      if (revDepths && (strand === 0 || strand === -1)) {
        bump(revDepths, lo, e, 1)
      }
    }
  }
  for (const g of gaps) {
    const s = g.start - actualStart
    const e = g.end - actualStart
    if (s < numBins && e > 0) {
      const lo = s > 0 ? s : 0
      const strand = g.featureStrand
      bump(depths, lo, e, -1)
      if (fwdDepths && (strand === 0 || strand === 1)) {
        bump(fwdDepths, lo, e, -1)
      }
      if (revDepths && (strand === 0 || strand === -1)) {
        bump(revDepths, lo, e, -1)
      }
    }
  }
  const sum = (diff: Float32Array) => {
    let acc = 0
    for (let i = 0; i < numBins; i++) {
      acc += diff[i]!
      diff[i] = acc > 0 ? acc : 0
    }
  }
  sum(depths)
  if (fwdDepths) {
    sum(fwdDepths)
  }
  if (revDepths) {
    sum(revDepths)
  }
  return { depths, fwdDepths, revDepths }
}

// ---------------------------------------------------------------------------
// SNP segments: three arms, each a separate function literal

const laneOf = (base: number | undefined) =>
  base === 65 ? 0 : base === 67 ? 1 : base === 71 ? 2 : base === 84 ? 3 : 4

// BASELINE. Two full walks of the window: one to size, one to fill.
const snpWindowScan = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  maxDepth: number,
  coverageStartPos: number,
) => {
  const windowLength = coverageDepths.length
  const counts = new Uint32Array(windowLength * 5)
  for (let i = 0; i < mismatchPositions.length; i++) {
    const offset = mismatchPositions[i]! - coverageStartPos
    if (offset >= 0 && offset < windowLength) {
      counts[offset * 5 + laneOf(mismatchBases[i])]! += 1
    }
  }
  let count = 0
  for (let offset = 0; offset < windowLength; offset++) {
    if (coverageDepths[offset]! > 0) {
      const lane = offset * 5
      for (let i = 0; i < 5; i++) {
        if (counts[lane + i]! > 0) {
          count++
        }
      }
    }
  }
  const positions = new Uint32Array(count)
  const yOffsets = new Float32Array(count)
  const heights = new Float32Array(count)
  const colorTypes = new Uint8Array(count)
  const relDepths = new Float32Array(count)
  let idx = 0
  for (let offset = 0; offset < windowLength; offset++) {
    const totalDepth = coverageDepths[offset]!
    if (totalDepth > 0) {
      const lane = offset * 5
      const relDepth = totalDepth / maxDepth
      let yOffset = 0
      for (let i = 0; i < 5; i++) {
        const n = counts[lane + i]!
        if (n > 0) {
          const height = n / totalDepth
          positions[idx] = offset + coverageStartPos
          yOffsets[idx] = yOffset
          heights[idx] = height
          colorTypes[idx] = i + 1
          relDepths[idx] = relDepth
          idx++
          yOffset += height
        }
      }
    }
  }
  return { positions, yOffsets, heights, colorTypes, relDepths, count }
}

// Set bits in a 5-lane mask, for the run-walk's sizing pass.
const LANES_SET = Uint8Array.from({ length: 32 }, (_, m) => {
  let n = 0
  for (let bit = 0; bit < 5; bit++) {
    n += (m >> bit) & 1
  }
  return n
})

// NEW. No per-bp structure at all: the mismatches arrive ascending, so equal
// positions are contiguous and a run-walk with five scratch counters groups
// them. Costs the DATA, never the region.
const snpRunWalk = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  maxDepth: number,
  coverageStartPos: number,
) => {
  const windowLength = coverageDepths.length
  const len = mismatchPositions.length
  let count = 0
  let i = 0
  while (i < len) {
    const position = mismatchPositions[i]!
    const offset = position - coverageStartPos
    if (offset >= 0 && offset < windowLength && coverageDepths[offset]! > 0) {
      let mask = 0
      while (i < len && mismatchPositions[i] === position) {
        mask |= 1 << laneOf(mismatchBases[i])
        i++
      }
      count += LANES_SET[mask]!
    } else {
      while (i < len && mismatchPositions[i] === position) {
        i++
      }
    }
  }
  const positions = new Uint32Array(count)
  const yOffsets = new Float32Array(count)
  const heights = new Float32Array(count)
  const colorTypes = new Uint8Array(count)
  const relDepths = new Float32Array(count)
  const counts = new Uint32Array(5)
  let idx = 0
  i = 0
  while (i < len) {
    const position = mismatchPositions[i]!
    const offset = position - coverageStartPos
    const totalDepth =
      offset >= 0 && offset < windowLength ? coverageDepths[offset]! : 0
    while (i < len && mismatchPositions[i] === position) {
      counts[laneOf(mismatchBases[i])]!++
      i++
    }
    if (totalDepth > 0) {
      const relDepth = totalDepth / maxDepth
      let yOffset = 0
      for (let lane = 0; lane < 5; lane++) {
        const n = counts[lane]!
        if (n > 0) {
          counts[lane] = 0
          const height = n / totalDepth
          positions[idx] = position
          yOffsets[idx] = yOffset
          heights[idx] = height
          colorTypes[idx] = lane + 1
          relDepths[idx] = relDepth
          idx++
          yOffset += height
        }
      }
    } else {
      counts[0] = 0
      counts[1] = 0
      counts[2] = 0
      counts[3] = 0
      counts[4] = 0
    }
  }
  return { positions, yOffsets, heights, colorTypes, relDepths, count }
}

// CONTROL. Byte-identical to snpWindowScan; separate literal on purpose.
const snpControl = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  maxDepth: number,
  coverageStartPos: number,
) => {
  const windowLength = coverageDepths.length
  const counts = new Uint32Array(windowLength * 5)
  for (let i = 0; i < mismatchPositions.length; i++) {
    const offset = mismatchPositions[i]! - coverageStartPos
    if (offset >= 0 && offset < windowLength) {
      counts[offset * 5 + laneOf(mismatchBases[i])]! += 1
    }
  }
  let count = 0
  for (let offset = 0; offset < windowLength; offset++) {
    if (coverageDepths[offset]! > 0) {
      const lane = offset * 5
      for (let i = 0; i < 5; i++) {
        if (counts[lane + i]! > 0) {
          count++
        }
      }
    }
  }
  const positions = new Uint32Array(count)
  const yOffsets = new Float32Array(count)
  const heights = new Float32Array(count)
  const colorTypes = new Uint8Array(count)
  const relDepths = new Float32Array(count)
  let idx = 0
  for (let offset = 0; offset < windowLength; offset++) {
    const totalDepth = coverageDepths[offset]!
    if (totalDepth > 0) {
      const lane = offset * 5
      const relDepth = totalDepth / maxDepth
      let yOffset = 0
      for (let i = 0; i < 5; i++) {
        const n = counts[lane + i]!
        if (n > 0) {
          const height = n / totalDepth
          positions[idx] = offset + coverageStartPos
          yOffsets[idx] = yOffset
          heights[idx] = height
          colorTypes[idx] = i + 1
          relDepths[idx] = relDepth
          idx++
          yOffset += height
        }
      }
    }
  }
  return { positions, yOffsets, heights, colorTypes, relDepths, count }
}

// The second shape. The size is derived off each lane's 0 -> 1 transition
// during the mismatch walk, and the fill is bounded to the span the mismatches
// occupy — but the lane array is still window-sized, and one mismatch near each
// end widens the fill bound back to the whole window.
const snpDataBound = (
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  maxDepth: number,
  coverageStartPos: number,
) => {
  const windowLength = coverageDepths.length
  const counts = new Uint32Array(windowLength * 5)
  let count = 0
  let minOffset = windowLength
  let maxOffset = -1
  for (let i = 0; i < mismatchPositions.length; i++) {
    const offset = mismatchPositions[i]! - coverageStartPos
    if (offset >= 0 && offset < windowLength) {
      const at = offset * 5 + laneOf(mismatchBases[i])
      if (counts[at]!++ === 0 && coverageDepths[offset]! > 0) {
        count++
      }
      if (offset < minOffset) {
        minOffset = offset
      }
      if (offset > maxOffset) {
        maxOffset = offset
      }
    }
  }
  const positions = new Uint32Array(count)
  const yOffsets = new Float32Array(count)
  const heights = new Float32Array(count)
  const colorTypes = new Uint8Array(count)
  const relDepths = new Float32Array(count)
  let idx = 0
  for (let offset = minOffset; offset <= maxOffset; offset++) {
    const totalDepth = coverageDepths[offset]!
    if (totalDepth > 0) {
      const lane = offset * 5
      const relDepth = totalDepth / maxDepth
      let yOffset = 0
      for (let i = 0; i < 5; i++) {
        const n = counts[lane + i]!
        if (n > 0) {
          const height = n / totalDepth
          positions[idx] = offset + coverageStartPos
          yOffsets[idx] = yOffset
          heights[idx] = height
          colorTypes[idx] = i + 1
          relDepths[idx] = relDepth
          idx++
          yOffset += height
        }
      }
    }
  }
  return { positions, yOffsets, heights, colorTypes, relDepths, count }
}

// ---------------------------------------------------------------------------
// identity

function sameFloats(a: Float32Array | undefined, b: Float32Array | undefined) {
  if (!a || !b) {
    return a === b
  }
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

function checkSweep(name: string, base: any, next: any) {
  const bad =
    !sameFloats(base.depths, next.depths) ||
    !sameFloats(base.fwdDepths, next.fwdDepths) ||
    !sameFloats(base.revDepths, next.revDepths)
  if (bad) {
    const which = !sameFloats(base.depths, next.depths)
      ? 'depths'
      : !sameFloats(base.fwdDepths, next.fwdDepths)
        ? 'fwdDepths'
        : 'revDepths'
    console.error(`  IDENTITY FAIL (${name}): ${which} differ`)
    if (!ALLOW_DIFF) {
      process.exit(1)
    }
  }
}

function checkSnp(name: string, base: any, next: any) {
  const fields = [
    'positions',
    'yOffsets',
    'heights',
    'colorTypes',
    'relDepths',
  ] as const
  if (base.count !== next.count) {
    console.error(
      `  IDENTITY FAIL (${name}): count ${base.count} vs ${next.count}`,
    )
    if (!ALLOW_DIFF) {
      process.exit(1)
    }
    return
  }
  for (const f of fields) {
    for (let i = 0; i < base.count; i++) {
      if (base[f][i] !== next[f][i]) {
        console.error(
          `  IDENTITY FAIL (${name}): ${f}[${i}] ${base[f][i]} vs ${next[f][i]}`,
        )
        if (!ALLOW_DIFF) {
          process.exit(1)
        }
        return
      }
    }
  }
}

// ---------------------------------------------------------------------------
// driver

declare const gc: (() => void) | undefined

function report(rows: { label: string; ms: number }[], baseline: string) {
  const base = rows.find(r => r.label === baseline)!.ms
  for (const r of rows) {
    const ratio = base / r.ms
    console.log(
      `  ${r.label.padEnd(14)} ${r.ms.toFixed(2).padStart(8)} ms  ${ratio.toFixed(2)}x`,
    )
  }
}

const SWEEP_FIXTURES = [
  {
    // A deep short-read window: the regime where the read array dominates.
    name: 'shortread-300x',
    regionStart: 1_000_000,
    regionEnd: 1_100_000,
    readLength: 150,
    depth: 300,
    gapRate: 0.02,
  },
  {
    // Long reads: few features, so the prefix sums (3 x numBins) dominate and
    // the walk is nearly free. Here to show where the win ISN'T.
    name: 'longread-60x',
    regionStart: 1_000_000,
    regionEnd: 1_200_000,
    readLength: 15_000,
    depth: 60,
    gapRate: 0.4,
  },
]

for (const fx of SWEEP_FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const { features, gaps } = makeReads(
    fx.regionStart,
    fx.regionEnd,
    fx.readLength,
    fx.depth,
    fx.gapRate,
    12345,
  )
  // Same window the shipped fn would derive: regionEnd extended by any read
  // overhanging it, capped at one region width.
  let actualEnd = fx.regionEnd
  const maxExt = fx.regionEnd - fx.regionStart
  for (const f of features) {
    if (f.end > actualEnd && f.end <= fx.regionEnd + maxExt) {
      actualEnd = f.end
    }
  }
  const numBins = actualEnd - fx.regionStart

  // Identity, warming every arm the same way before any timing.
  const a = sweepThreePass(features, gaps, numBins, fx.regionStart, true)
  const b = sweepOnePass(features, gaps, numBins, fx.regionStart, true)
  const c = sweepControl(features, gaps, numBins, fx.regionStart, true)
  checkSweep(fx.name, a, b)
  checkSweep(`${fx.name} control`, a, c)
  // …and against what actually ships, which is the point of the arm.
  const shipped = computeCoverage(
    features,
    gaps,
    fx.regionStart,
    fx.regionEnd,
    true,
  )
  checkSweep(`${fx.name} shipped`, b, shipped)

  const best = {
    'three-pass': Infinity,
    'one-pass': Infinity,
    control: Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    // Rotate which arm goes first. Running them in a fixed order lets whichever
    // is last inherit the others' warmup — on the long-read fixture, where a
    // round is ~1ms, that alone put the byte-identical control at 2.6x.
    for (let k = 0; k < 3; k++) {
      const which = (r + k) % 3
      const t = performance.now()
      if (which === 0) {
        sweepThreePass(features, gaps, numBins, fx.regionStart, true)
      } else if (which === 1) {
        sweepOnePass(features, gaps, numBins, fx.regionStart, true)
      } else {
        sweepControl(features, gaps, numBins, fx.regionStart, true)
      }
      const ms = performance.now() - t
      const label =
        which === 0 ? 'three-pass' : which === 1 ? 'one-pass' : 'control'
      best[label] = Math.min(best[label], ms)
    }
  }
  console.log(
    `\ndepth sweep — ${fx.name}: ${features.length} reads, ${gaps.length} gaps, ${numBins} bins`,
  )
  report(
    [
      { label: 'three-pass', ms: best['three-pass'] },
      { label: 'one-pass', ms: best['one-pass'] },
      { label: 'control', ms: best.control },
    ],
    'three-pass',
  )
}

const SNP_FIXTURES = [
  {
    // Mismatches spread over the whole window: both arms walk the same span,
    // so this isolates the removed sizing walk.
    name: 'dense-spread',
    windowLength: 200_000,
    mismatches: 300_000,
    spanFrac: 1,
  },
  {
    // A wide window whose mismatches sit in a small part of it — a zoomed-out
    // pileup, or a MAF region. This is what the fill bound is for.
    name: 'sparse-clustered',
    windowLength: 500_000,
    mismatches: 5_000,
    spanFrac: 0.02,
  },
]

for (const fx of SNP_FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const coverageStartPos = 1_000_000
  const depths = new Float32Array(fx.windowLength)
  const rand = rng(777)
  for (let i = 0; i < fx.windowLength; i++) {
    depths[i] = Math.floor(rand() * 80)
  }
  const span = Math.floor(fx.windowLength * fx.spanFrac)
  const { positions, bases } = makeMismatches(
    coverageStartPos,
    coverageStartPos + span,
    fx.mismatches,
    999,
  )
  const maxDepth = 80

  const a = snpWindowScan(positions, bases, depths, maxDepth, coverageStartPos)
  const b = snpDataBound(positions, bases, depths, maxDepth, coverageStartPos)
  const c = snpControl(positions, bases, depths, maxDepth, coverageStartPos)
  const d = snpRunWalk(positions, bases, depths, maxDepth, coverageStartPos)
  checkSnp(fx.name, a, b)
  checkSnp(`${fx.name} control`, a, c)
  checkSnp(`${fx.name} run-walk`, a, d)
  // The shipped fn writes the packed instance buffer and has no array form, so
  // the identity check decodes it back into one. Same records, same order.
  const decoded = readSnpSegments(
    computeSNPCoverage(positions, bases, {
      depths,
      maxDepth,
      startPos: coverageStartPos,
    }).snpPackedBuffer,
  )
  checkSnp(`${fx.name} shipped`, a, {
    count: decoded.length,
    positions: decoded.map(s => s.position),
    yOffsets: decoded.map(s => s.yOffset),
    heights: decoded.map(s => s.height),
    colorTypes: decoded.map(s => s.colorType),
    relDepths: decoded.map(s => s.relDepth),
  })

  const ARMS = ['window-scan', 'data-bound', 'run-walk', 'control'] as const
  const best: Record<string, number> = {
    'window-scan': Infinity,
    'data-bound': Infinity,
    'run-walk': Infinity,
    control: Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    // Rotated, same reason as the sweep above. Each branch is its own call
    // expression to a distinct function literal, so no call site goes
    // polymorphic — what rotates is the ORDER, not the dispatch.
    for (let k = 0; k < ARMS.length; k++) {
      const which = (r + k) % ARMS.length
      const t = performance.now()
      if (which === 0) {
        snpWindowScan(positions, bases, depths, maxDepth, coverageStartPos)
      } else if (which === 1) {
        snpDataBound(positions, bases, depths, maxDepth, coverageStartPos)
      } else if (which === 2) {
        snpRunWalk(positions, bases, depths, maxDepth, coverageStartPos)
      } else {
        snpControl(positions, bases, depths, maxDepth, coverageStartPos)
      }
      const ms = performance.now() - t
      const label = ARMS[which]!
      best[label] = Math.min(best[label]!, ms)
    }
  }
  console.log(
    `\nsnp segments — ${fx.name}: ${fx.windowLength} bins, ${fx.mismatches} mismatches over ${span} bp, ${a.count} segments`,
  )
  report(
    ARMS.map(label => ({ label, ms: best[label]! })),
    'window-scan',
  )
}
