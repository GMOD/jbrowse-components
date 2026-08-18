// Deliberately the `/constants` and `/normalize` entries, not the
// `@jbrowse/wiggle-core` barrel: this package is worker/math-side and the barrel
// re-exports React components (CrossHatches, SetMinMaxDialog, the menu
// builders), so the barrel would drag React + MUI into every consumer of
// alignments-core. The type imports below are erased, so they can keep using the
// barrel.
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core/normalize'

import { coverageLayout } from './coverageBandBox.ts'
import { forEachAtPosition, lowerBound } from './positionIndex.ts'

import type { ScoreStats, YScaleTicks } from '@jbrowse/wiggle-core'

export function niceStep(maxDepth: number) {
  const rough = maxDepth / 3
  const exp = Math.floor(Math.log10(rough))
  const pow = Math.pow(10, exp)
  const frac = rough / pow
  let niceFrac
  if (frac < 1.5) {
    niceFrac = 1
  } else if (frac < 3) {
    niceFrac = 2
  } else if (frac < 7) {
    niceFrac = 5
  } else {
    niceFrac = 10
  }
  return niceFrac * pow
}

/**
 * The domain the coverage band actually draws against — its autoscaled/bounded
 * `[min, max]`, with a log scale's floor pulled up to 1.
 *
 * Depth is a count of whole reads, which is what separates this axis from a
 * wiggle track's. `getNiceDomain` deliberately keeps a log domain under 1 (a
 * mappability track, a methylation fraction), and for a shallow pileup it
 * produces exactly that: a single-read region nices to `[0.0078125, 1]`, whose
 * octave ladder is eight fractional read counts. One read is the floor.
 *
 * Applied once, by the display, so the ticks and both renderers are handed the
 * same already-floored pair — the alternative is this rule spelled in the axis,
 * in the Canvas2D scale and in the uniform write, which is how the min came to
 * be dropped by all three in the first place.
 */
export function coverageDepthDomain(
  domain: readonly [number, number],
  scaleType: string,
): [number, number] {
  const [min, max] = domain
  return scaleType === 'log' ? [Math.max(1, min), max] : [min, max]
}

// Below this band height the axis drops to its two endpoints: a full ladder's
// 10px labels need ~15px of vertical room apiece and there isn't any.
// Deliberately above `COMPACT_AXIS_HEIGHT` (30, where the axis gives up
// entirely and becomes a one-line `[min, max]` caption) — between the two a
// two-tick axis still reads.
const FULL_LADDER_MIN_HEIGHT = 70

/**
 * The depth the coverage axis starts from, which is the depth the bars draw flat
 * at. Normally the domain's own min — an autoscaled domain starts at 0, a
 * `minScore` bound starts wherever the user put it.
 *
 * A log scale cannot start at 0, so it floors at 1. That is not a rule of this
 * file: it is `makeScoreNormalizer`'s (`min > 0 ? min : 1`), and it has to be
 * read off the same condition here or the baseline tick stops being the depth
 * the bars flatten at.
 */
function coverageBaseline(domainMin: number, scaleType: string) {
  return scaleType === 'log' && domainMin <= 0 ? 1 : domainMin
}

/**
 * The three ladders below all answer in **values**, leaving the value → y
 * mapping to one place. They are the whole of what differs between the branches,
 * so each can be read against its own rule without the geometry in the way.
 *
 * Every one of them starts at `baseline`, is required to end at `max` or below
 * it, and must emit no value twice: `YScaleBar` and `CrossHatchLines` both key
 * on `${value}-${y}`, so a repeat is a React duplicate-key warning and a label
 * drawn over itself.
 */
function endpointTickValues(baseline: number, max: number) {
  return baseline === max ? [max] : [baseline, max]
}

/**
 * The baseline, then successive doublings of it, up to `max` — and `max` itself
 * if no doubling landed on it. Doublings *of the baseline* rather than of 1, so
 * a bounded domain gets the same octave ladder its own floor implies; with the
 * usual baseline of 1 that is the plain 1, 2, 4, 8 … it has always been.
 */
function octaveTickValues(baseline: number, max: number) {
  const values = [baseline]
  for (let tick = baseline * 2; tick <= max; tick *= 2) {
    values.push(tick)
  }
  // A log axis whose octave ladder never fired still wants a top tick — but only
  // when max isn't the baseline already pushed.
  if (values.length < 2 && max > baseline) {
    values.push(max)
  }
  return values
}

/** The baseline, then nice steps up from it, to the last one at or below `max`. */
function niceStepTickValues(baseline: number, max: number) {
  // Depth is integer-valued, so floor the nice step to 1: for a span under 3
  // niceStep returns 0.5, which would emit meaningless fractional depth labels
  // (0, 0.5, 1).
  const step = Math.max(1, niceStep(max - baseline))
  const stepCount = Math.floor((max - baseline) / step)
  return Array.from({ length: stepCount + 1 }, (_, i) => baseline + i * step)
}

function coverageTickValues(
  baseline: number,
  max: number,
  coverageHeight: number,
  scaleType: string,
) {
  // The short-band gate is on BOTH scale types on purpose. The log ladder used
  // to run at every height, so a 40px band over a depth-100 pileup drew seven
  // labels into 30px of space — and its top rung is the last power of 2 *below*
  // the max (64 for 100), so the band's own ceiling went unlabelled while the
  // linear branch at the same height labelled it. The compact `[min, max]`
  // fallback under COMPACT_AXIS_HEIGHT reads the top tick, so it inherited that
  // 64 as the scale max it announced.
  if (coverageHeight < FULL_LADDER_MIN_HEIGHT) {
    return endpointTickValues(baseline, max)
  }
  return scaleType === 'log'
    ? octaveTickValues(baseline, max)
    : niceStepTickValues(baseline, max)
}

/**
 * Y-axis ticks for the coverage band.
 *
 * Takes the whole `[min, max]` domain, not just the max, and places its ticks
 * with the same `makeScoreNormalizer` the Canvas2D coverage draws and the
 * shader's `normalizeDepth` use. It used to take a bare max and carry a
 * hand-written normalizer of its own, which is how a `minScore` bound came to be
 * computed into `coverageDomain[0]` and then read by nothing at all.
 */
export function computeCoverageTicks(
  domain: readonly [number, number],
  coverageHeight: number,
  scaleType = 'linear',
): YScaleTicks {
  // The box the coverage marks are drawn in, not a second spelling of it: the
  // bars measure up from `bottom` over `effectiveH` (rendererUtils, and the
  // shader those numbers are generated from), so a tick placed any other way is
  // a tick that doesn't sit on its own data. This used to open-code
  // `coverageHeight - offset` / `coverageHeight - 2 * offset`, the same twin
  // `coverageBandLayoutParity.test.ts` retired from the drawing side.
  const { effectiveH, bottom } = coverageLayout(coverageHeight)
  const yTop = YSCALEBAR_LABEL_OFFSET
  const yBottom = bottom
  const [domainMin, max] = domain

  if (max === 0) {
    return { items: [], yTop, yBottom }
  }

  const baseline = coverageBaseline(domainMin, scaleType)
  const normalize = makeScoreNormalizer(domainMin, max, scaleType === 'log')
  const yOf = (value: number) => yBottom - normalize(value) * effectiveH

  // A domain whose bound swallows the data (minScore above the visible peak)
  // leaves nothing to ladder between; one tick at the top is the honest axis for
  // a band where every bar is flat.
  const values =
    max > baseline
      ? coverageTickValues(baseline, max, coverageHeight, scaleType)
      : [max]

  return {
    items: values.map(value => ({ value, y: yOf(value) })),
    yTop,
    yBottom,
  }
}

export interface CoverageRegion {
  coverageDepths: Float32Array
  coverageStartPos: number
  // Coarse per-bin partial stats (downsampleStatsBins). Present only when the
  // per-bp array exceeded the bin cap (whole-chromosome scale); when absent the
  // reducer scans coverageDepths per-bp for exact visible-edge clipping.
  coverageStatsBinSize?: number
  coverageStatsMins?: Float32Array
  coverageStatsMaxs?: Float32Array
  coverageStatsSums?: Float64Array
  coverageStatsSumSqs?: Float64Array
}

interface StatsAcc {
  min: number
  max: number
  sum: number
  sumSq: number
  count: number
}

// Reads the coarse stats sidecar off a region, or undefined when it carries
// none — below the bin cap (binSize 1, empty arrays) or a per-bp-only source
// like MAF. The four arrays are emitted as a unit (downsampleStatsBins) and so
// only ever exist together; checking them together here is what lets the
// reducer read them with no non-null assertions.
function readStatsSidecar(cov: CoverageRegion): CoverageStatsBins | undefined {
  const {
    coverageStatsBinSize,
    coverageStatsMins,
    coverageStatsMaxs,
    coverageStatsSums,
    coverageStatsSumSqs,
  } = cov
  return coverageStatsBinSize !== undefined &&
    coverageStatsBinSize > 1 &&
    coverageStatsMins &&
    coverageStatsMaxs &&
    coverageStatsSums &&
    coverageStatsSumSqs
    ? {
        binSize: coverageStatsBinSize,
        mins: coverageStatsMins,
        maxs: coverageStatsMaxs,
        sums: coverageStatsSums,
        sumSqs: coverageStatsSumSqs,
      }
    : undefined
}

// Fold one block's visible [start,end) into the running accumulator. Large
// regions carry coarse binned stats (downsampleStatsBins) and reduce over whole
// bins — O(bins) instead of O(bp), which is what kills the per-bp pan/zoom scan.
// Bin-granular clipping over-includes at most one partial bin per visible edge,
// negligible at the zoom where binning engages (binSize << visible span). Small
// regions scan per-bp for exact clipping (byte-identical to the pre-binning
// path).
function accumulateBlockStats(
  acc: StatsAcc,
  cov: CoverageRegion,
  blockStart: number,
  blockEnd: number,
) {
  const { coverageStartPos } = cov
  const n = cov.coverageDepths.length
  const sidecar = readStatsSidecar(cov)
  if (sidecar) {
    const { binSize, mins, maxs, sums, sumSqs } = sidecar
    const startBin = Math.max(
      0,
      Math.floor((blockStart - coverageStartPos) / binSize),
    )
    const endBin = Math.min(
      maxs.length,
      Math.ceil((blockEnd - coverageStartPos) / binSize),
    )
    for (let b = startBin; b < endBin; b++) {
      if (mins[b]! < acc.min) {
        acc.min = mins[b]!
      }
      if (maxs[b]! > acc.max) {
        acc.max = maxs[b]!
      }
      acc.sum += sums[b]!
      acc.sumSq += sumSqs[b]!
      // bp this bin covers: binSize, except the ragged last bin (clamped to n).
      // Added per bin, beside its own sum, so count spans exactly the bp summed
      // — it only feeds mean/stdDev (localsd autoscale).
      acc.count += Math.min((b + 1) * binSize, n) - b * binSize
    }
  } else {
    const startIdx = Math.max(0, Math.floor(blockStart - coverageStartPos))
    const endIdx = Math.min(n, Math.ceil(blockEnd - coverageStartPos))
    for (let i = startIdx; i < endIdx; i++) {
      const d = cov.coverageDepths[i]!
      if (d < acc.min) {
        acc.min = d
      }
      if (d > acc.max) {
        acc.max = d
      }
      acc.sum += d
      acc.sumSq += d * d
      acc.count++
    }
  }
}

export function computeVisibleCoverageStats<
  B extends { start: number; end: number },
>(
  visibleBlocks: B[],
  getCoverageForBlock: (block: B) => CoverageRegion | undefined,
): ScoreStats | undefined {
  const acc: StatsAcc = {
    min: Infinity,
    max: -Infinity,
    sum: 0,
    sumSq: 0,
    count: 0,
  }
  for (const block of visibleBlocks) {
    const cov = getCoverageForBlock(block)
    if (cov) {
      accumulateBlockStats(acc, cov, block.start, block.end)
    }
  }
  if (acc.count === 0 || !Number.isFinite(acc.max)) {
    return undefined
  }
  const mean = acc.sum / acc.count
  const stdDev = Math.sqrt(Math.max(0, acc.sumSq / acc.count - mean * mean))
  return {
    scoreMin: acc.min,
    scoreMax: acc.max,
    scoreMean: mean,
    scoreStdDev: stdDev,
  }
}

// Reduce a per-bp depth array to at most `maxBins` DENSE bins, each holding the
// MAX depth over its bp span (peak-preserving, like a wiggle bar at low zoom).
// Returns the input verbatim with binSize 1 when it already fits, so the
// zoomed-in path is byte-identical to per-bp. Dense and index-addressable — bin
// b covers [startPos + b*binSize, startPos + (b+1)*binSize) — which is what the
// single `binSize` GPU uniform and any bin = floor((pos-start)/binSize) lookup
// need. Bin-by-bin (not a per-bp divide) to stay a tight typed-array loop.
export function downsampleDenseMax(depths: Float32Array, maxBins: number) {
  const n = depths.length
  if (n <= maxBins) {
    return { depths, binSize: 1 }
  }
  const binSize = Math.ceil(n / maxBins)
  const numBins = Math.ceil(n / binSize)
  const out = new Float32Array(numBins)
  for (let b = 0; b < numBins; b++) {
    const from = b * binSize
    const to = Math.min(from + binSize, n)
    let hi = 0
    for (let i = from; i < to; i++) {
      const d = depths[i]!
      if (d > hi) {
        hi = d
      }
    }
    out[b] = hi
  }
  return { depths: out, binSize }
}

export interface CoverageStatsBins {
  binSize: number
  // Per-bin partial stats over the per-bp depths. `count` isn't stored: bin b
  // holds binSize bp except the last (a ragged tail), which the reducer derives
  // from the per-bp array length it already holds. sums/sumSqs are Float64 —
  // the per-bp path accumulates in JS numbers (f64) too, so this matches its
  // precision.
  mins: Float32Array
  maxs: Float32Array
  sums: Float64Array
  sumSqs: Float64Array
}

// Coarse per-bin partial stats (min/max/sum/sumSq) over per-bp depths, so the
// main thread's visible-range autoscale reduce is O(bins) not O(bp). At
// whole-chromosome scale the per-bp array is tens of millions of entries and a
// full scan on every coarse-block change (~500ms during pan) is the coverage
// band's pan/zoom jank. Returns empty arrays (binSize 1) when the per-bp array
// already fits `maxBins`: the main thread then scans per-bp for exact
// visible-edge clipping — cheap at that zoom, and byte-identical to the old
// path. Mirrors downsampleDenseMax's shape (same cap, same binSize formula) so
// the stats bins and the GPU depth bars align bin-for-bin.
export function downsampleStatsBins(
  depths: Float32Array,
  maxBins: number,
): CoverageStatsBins {
  const n = depths.length
  if (n <= maxBins) {
    return {
      binSize: 1,
      mins: new Float32Array(0),
      maxs: new Float32Array(0),
      sums: new Float64Array(0),
      sumSqs: new Float64Array(0),
    }
  }
  const binSize = Math.ceil(n / maxBins)
  const numBins = Math.ceil(n / binSize)
  const mins = new Float32Array(numBins)
  const maxs = new Float32Array(numBins)
  const sums = new Float64Array(numBins)
  const sumSqs = new Float64Array(numBins)
  for (let b = 0; b < numBins; b++) {
    const from = b * binSize
    const to = Math.min(from + binSize, n)
    let lo = Infinity
    let hi = 0
    let sum = 0
    let sumSq = 0
    for (let i = from; i < to; i++) {
      const d = depths[i]!
      if (d < lo) {
        lo = d
      }
      if (d > hi) {
        hi = d
      }
      sum += d
      sumSq += d * d
    }
    mins[b] = lo === Infinity ? 0 : lo
    maxs[b] = hi
    sums[b] = sum
    sumSqs[b] = sumSq
  }
  return { binSize, mins, maxs, sums, sumSqs }
}

export interface CoverageTooltipBin {
  position: number
  depth: number
  // Total depth split by read strand. Undefined for callers that don't sweep
  // per-strand coverage (e.g. MAF).
  fwdDepth?: number
  revDepth?: number
  interbaseDepth: number
  snps: Record<string, { count: number; fwd: number; rev: number }>
  deletions?: {
    count: number
    minLen: number
    maxLen: number
    avgLen: number
  }
  interbase: Record<
    string,
    {
      count: number
      minLen: number
      maxLen: number
      avgLen: number
      topSeq?: string
      topSeqCount?: number
    }
  >
  modifications?: {
    count: number
    fwd: number
    rev: number
    probabilityTotal: number
    color: string
    name: string
  }[]
}

export interface MismatchArrays {
  mismatchPositions: Uint32Array
  mismatchBases: Uint8Array
  mismatchStrands?: Uint8Array | Int8Array
}

export interface CoverageArrays {
  coverageDepths: Float32Array
  coverageStartPos: number
}

// Interbase events (insertions/softclips/hardclips) sit at a base *boundary*,
// not inside a cell, so their depth basis is the deeper of the two flanking
// bins — at a coverage cliff one side can be ~0 and would give a misleading
// proportion. Single source for the indicator, shader-fade and tooltip paths.
export function interbaseDepthAt(
  coverageDepths: Float32Array,
  coverageStartPos: number,
  position: number,
) {
  const idx = position - coverageStartPos
  const left = idx - 1 >= 0 ? (coverageDepths[idx - 1] ?? 0) : 0
  const right =
    idx >= 0 && idx < coverageDepths.length ? (coverageDepths[idx] ?? 0) : 0
  return Math.max(left, right)
}

/**
 * Per-base SNP counts at one absolute genomic position, with the strand split
 * when the caller ships strands (alignments does; MAF does not).
 *
 * `position` is absolute, not an offset into the coverage window — it was named
 * `posOffset` and compared against `mismatchPositions`, which are absolute, so
 * the name was simply wrong at both call sites.
 *
 * A hover asks about ONE position out of an array holding every mismatch in the
 * region, so it binary-searches instead of scanning. `mismatchPositions` ARRIVES
 * ascending — `buildMismatchArrays` sorts it in the worker and MAF's writer emits
 * it that way — so the run at `position` is contiguous and the parallel arrays
 * are read at the same index, with no side index to build, cache or invalidate.
 */
export function countSnpsAtPosition(
  position: number,
  mismatches: MismatchArrays,
) {
  const { mismatchPositions, mismatchBases, mismatchStrands } = mismatches
  const snps: Record<string, { count: number; fwd: number; rev: number }> = {}
  const n = mismatchPositions.length
  for (let i = lowerBound(mismatchPositions, position); i < n; i++) {
    if (mismatchPositions[i] !== position) {
      break
    }
    const base = String.fromCharCode(mismatchBases[i]!)
    snps[base] ??= { count: 0, fwd: 0, rev: 0 }
    snps[base].count++
    if (mismatchStrands) {
      // A read with no strand (0) is neither, and adding it to `rev` — which is
      // what an `=== 1 ? fwd : rev` split did — reports a reverse-strand read
      // that does not exist. `count` still holds it, so the two need not sum.
      if (mismatchStrands[i] === 1) {
        snps[base].fwd++
      } else if (mismatchStrands[i] === -1) {
        snps[base].rev++
      }
    }
  }
  return snps
}

/**
 * The floor under any tooltip-snap threshold, and the default one.
 *
 * The snap exists to name the bp a user is pointing AT when a pixel covers many
 * — so it has to pick the dominant event in the pixel, not merely a drawn one.
 * At depth 500 every sequencing error is drawn (the coverage band's own floor
 * defaults to 0), so a threshold of 0 makes every bp qualify and the snap
 * degenerates to "the leftmost bp in the pixel".
 *
 * A caller whose band hides more than this raises it — `hitTestCoverage` passes
 * `max(this, coverageSnpMinFrequency)` so the snap can never name a segment the
 * band declined to colour. Nobody lowers it. Shared rather than spelled at each
 * call site: it was the literal `0.05` twice, the second under a comment saying
 * "mirrors alignments", which is the shape a constant takes just before the two
 * copies stop matching.
 */
export const SNP_TOOLTIP_SNAP_FLOOR = 0.05

/**
 * Genomic position of the first event in [binStart, binEnd) that is
 * "significant" — more than `threshold` fraction of the local coverage depth at
 * that position. When a pixel spans many bp (zoomed out), an exact-position
 * lookup misses the event sitting elsewhere in the bin; callers scan the pixel's
 * bp range with this and tooltip the significant position instead. Returns
 * undefined if nothing qualifies.
 *
 * Visits the events in the BIN rather than every event in the region — this is on
 * the mousemove path, and the array it was scanning holds every mismatch in the
 * block. `positions` must be ASCENDING, which both producers guarantee
 * (`buildMismatchArrays`, and MAF's `MismatchWriter` by construction). Two things
 * fall out of that order which a read-order scan had to arrange for itself: equal
 * positions are adjacent, so counting a position needs no Map, and the run is
 * walked ascending, so the first qualifying position IS the smallest and the
 * `pos < best` comparison goes away with the loop that needed it.
 */
export function findSignificantInBin(
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) {
  const len = positions.length
  let k = lowerBound(positions, binStart)
  while (k < len && positions[k]! < binEnd) {
    const pos = positions[k]!
    let n = 0
    while (k < len && positions[k] === pos) {
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

// Flat per-event interbase arrays (one entry per insertion), parallel to
// `MismatchArrays`. Only insertion-type events are modeled — the callers that
// pass these (e.g. MAF) emit no soft/hard clips.
//
// `interbasePositions` must be ASCENDING within each block named by `blockEnds`.
// MAF passes one block and omits the field; the alignments worker's array is
// three, since its (insertions, softclips, hardclips) grouping is sliced by three
// GPU passes and so cannot be sorted across. See `forEachAtPosition`.
export interface InterbaseArrays {
  interbasePositions: Uint32Array
  interbaseLengths: Uint32Array
  blockEnds?: readonly number[]
}

// Aggregate insertion-type interbase events anchored at `position` into the
// tooltip bin's `interbase.insertion` summary (count + length range/avg).
// Binary-searches the shipped array like its two neighbours above — a hover reads
// one position out of every insertion in the region, and retains nothing.
function countInterbaseAtPosition(
  position: number,
  { interbasePositions, interbaseLengths, blockEnds }: InterbaseArrays,
) {
  let count = 0
  let minLen = Infinity
  let maxLen = 0
  let lenSum = 0
  forEachAtPosition(
    interbasePositions,
    blockEnds ?? [interbasePositions.length],
    position,
    i => {
      const len = interbaseLengths[i]!
      count++
      lenSum += len
      if (len < minLen) {
        minLen = len
      }
      if (len > maxLen) {
        maxLen = len
      }
    },
  )
  const interbase: CoverageTooltipBin['interbase'] = {}
  if (count > 0) {
    interbase.insertion = { count, minLen, maxLen, avgLen: lenSum / count }
  }
  return interbase
}

export function buildCoverageTooltipBin(
  position: number,
  coverage: CoverageArrays,
  mismatches: MismatchArrays,
  interbaseArrays?: InterbaseArrays,
  // Interbase events are anchored at a base *boundary*, not inside a cell, so
  // callers pass the nearest boundary (`round(gposFrac)`) here while `position`
  // stays the containing cell (`floor`) used for depth/SNP. Defaults to
  // `position` for callers that don't distinguish.
  interbasePosition = position,
): CoverageTooltipBin | undefined {
  const binIdx = Math.floor(position - coverage.coverageStartPos)
  const depth = coverage.coverageDepths[binIdx] ?? 0
  const interbase = interbaseArrays
    ? countInterbaseAtPosition(interbasePosition, interbaseArrays)
    : {}
  const hasInterbase = interbase.insertion !== undefined
  if (depth === 0 && !hasInterbase) {
    return undefined
  }
  return {
    position,
    depth,
    interbaseDepth: hasInterbase
      ? interbaseDepthAt(
          coverage.coverageDepths,
          coverage.coverageStartPos,
          position,
        )
      : 0,
    snps: depth > 0 ? countSnpsAtPosition(position, mismatches) : {},
    interbase,
  }
}

export interface MismatchEntry {
  position: number
  base: number // ASCII code: 65=A, 67=C, 71=G, 84=T
  strand: number
}

export { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
