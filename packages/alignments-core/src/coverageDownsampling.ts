// Deliberately the `/constants` and `/normalize` entries, not the
// `@jbrowse/wiggle-core` barrel: this package is worker/math-side and the barrel
// re-exports React components (CrossHatches, SetMinMaxDialog, the menu
// builders), so the barrel would drag React + MUI into every consumer of
// alignments-core. The type imports below are erased, so they can keep using the
// barrel.
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core/normalize'

import { coverageLayout } from './coverageBandBox.ts'
import { lowerBound, positionIndexFor } from './positionIndex.ts'

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
 * region, so it goes through the shared position index rather than scanning.
 * See positionIndex.ts for why the cache hangs off the array itself.
 */
export function countSnpsAtPosition(
  position: number,
  mismatches: MismatchArrays,
) {
  const { mismatchPositions, mismatchBases, mismatchStrands } = mismatches
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
 * Genomic position of the first event in [binStart, binEnd) that is
 * "significant" — at least `threshold` fraction of the local coverage depth at
 * that position. When a pixel spans many bp (zoomed out), an exact-position
 * lookup misses the event sitting elsewhere in the bin; callers scan the pixel's
 * bp range with this and tooltip the significant position instead. Returns
 * undefined if nothing qualifies.
 *
 * Runs over the shared position index, so it visits the events in the BIN
 * rather than every event in the region — this is on the mousemove path, and
 * the array it was scanning holds every mismatch in the block. Two things fall
 * out of the index that the scan had to arrange for itself: equal positions are
 * adjacent, so counting a position needs no Map, and the run is walked in
 * ascending order, so the first qualifying position IS the smallest and the
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

// Flat per-event interbase arrays (one entry per insertion), parallel to
// `MismatchArrays`. Only insertion-type events are modeled — the callers that
// pass these (e.g. MAF) emit no soft/hard clips.
export interface InterbaseArrays {
  interbasePositions: Uint32Array
  interbaseLengths: Uint32Array
}

// Aggregate insertion-type interbase events anchored at `position` into the
// tooltip bin's `interbase.insertion` summary (count + length range/avg).
// Through the position index, like its two neighbours above — a hover reads one
// position out of every insertion in the region.
function countInterbaseAtPosition(
  position: number,
  { interbasePositions, interbaseLengths }: InterbaseArrays,
) {
  let count = 0
  let minLen = Infinity
  let maxLen = 0
  let lenSum = 0
  const { order, sorted } = positionIndexFor(interbasePositions)
  for (let k = lowerBound(sorted, position); k < sorted.length; k++) {
    if (sorted[k] !== position) {
      break
    }
    const len = interbaseLengths[order[k]!]!
    count++
    lenSum += len
    if (len < minLen) {
      minLen = len
    }
    if (len > maxLen) {
      maxLen = len
    }
  }
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

/**
 * The zero-segment result — what `computeSNPCoverage` answers for a region with
 * no mismatches, and what the paths that skip the coverage band entirely
 * substitute for it. One spelling, so a field added to `SNPCoverageResult`
 * cannot be added to some of them. It was written out three times, and the
 * matching `emptyInterbaseCoverage` next door is the same idea.
 *
 * Allocated fresh per call rather than shared: the worker transfers these
 * arrays, which detaches them, so a module-level singleton would throw
 * DataCloneError on the second RPC reply.
 */
export function emptySnpCoverage(): SNPCoverageResult {
  return {
    positions: new Uint32Array(0),
    yOffsets: new Float32Array(0),
    heights: new Float32Array(0),
    colorTypes: new Uint8Array(0),
    relDepths: new Float32Array(0),
    count: 0,
  }
}

export interface SNPCoverageResult {
  positions: Uint32Array
  // yOffset/height are fractions of the per-position bar (not regional). Drawing
  // multiplies by the bar height at that position.
  yOffsets: Float32Array
  heights: Float32Array
  colorTypes: Uint8Array
  // relDepth = totalDepthAtPos / regionMaxDepth. Used to compute the per-position
  // bar height via normalizeDepth (linear or log) at draw time.
  relDepths: Float32Array
  count: number
}

/**
 * Compute SNP coverage segments for rendering colored bars in coverage area.
 * Groups mismatches by position, counts A/C/G/T (and N/other as one grey
 * bucket) per position, and creates stacked segments expressed as fractions of
 * THIS position's coverage bar. colorType: 1=A 2=C 3=G 4=T 5=N.
 *
 * Consumes the flat `mismatchPositions`/`mismatchBases` arrays directly (same
 * arrays the frequency pass reads) rather than an object array, so callers
 * don't hold a second `{position, base}[]` representation of the same
 * mismatches. A position left of the coverage window resolves to zero depth via
 * `depthAt` and emits no segment (the loops below gate on `depth > 0`), so
 * out-of-window mismatches drop out without an explicit filter.
 */
export function computeSNPCoverage(
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverage: { depths: Float32Array; maxDepth: number; startPos: number },
): SNPCoverageResult {
  const {
    depths: coverageDepths,
    maxDepth,
    startPos: coverageStartPos,
  } = coverage
  if (mismatchPositions.length === 0 || maxDepth === 0) {
    return emptySnpCoverage()
  }

  const windowLength = coverageDepths.length

  // Five counts per position — A, C, G, T, and one bucket for N and the IUPAC
  // ambiguity codes, drawn as a single grey segment — laid out interleaved and
  // indexed by offset into the coverage window, so a mismatch costs one array
  // increment.
  //
  // A `Map<position, {a,c,g,t,n}>` is the obvious shape and was what this did.
  // It allocates a heap object per *distinct* position and does a hash lookup
  // per mismatch, which on a 26-way MAF region means 381k objects behind 783k
  // lookups: measured 78ms against 27ms for this, ~2.9x, on identical output.
  // It is also usually *less* memory, not more — a position that carries any
  // mismatch costs 20 bytes here against an object plus its Map entry, and both
  // callers reach this with most positions carrying one. It costs more only for
  // mismatches scattered thinly across a wide window, and the window is already
  // dense: `coverageDepths` is one float per position of it.
  // The output arrays are pre-sized, so the segment count has to be known
  // before the fill — and it is derived HERE, off each lane's 0 -> 1
  // transition at a position with depth, rather than by a second walk of the
  // window. Same predicate ("lane non-empty, depth non-zero"), reached once per
  // emitted segment instead of once per bp: the window is `regionWidth` and the
  // mismatches are bounded by the data, so the counting walk was the one part
  // of this function that cost the region's width no matter how little was in
  // it — a MAF region or a zoomed-out pileup pays it in full to emit nothing.
  //
  // `minOffset`/`maxOffset` bound the fill walk to the span the mismatches
  // actually occupy, for the same reason. They stay inclusive-exclusive around
  // an empty set (min > max) so a window with no in-range mismatch walks
  // nothing.
  const counts = new Uint32Array(windowLength * 5)
  let count = 0
  let minOffset = windowLength
  let maxOffset = -1
  for (let i = 0; i < mismatchPositions.length; i++) {
    // A position outside the coverage window emits no segment, the same as
    // resolving to zero depth did before.
    const offset = mismatchPositions[i]! - coverageStartPos
    if (offset >= 0 && offset < windowLength) {
      const base = mismatchBases[i]
      const idx =
        offset * 5 +
        (base === 65
          ? 0
          : base === 67
            ? 1
            : base === 71
              ? 2
              : base === 84
                ? 3
                : 4)
      if (counts[idx]!++ === 0 && coverageDepths[offset]! > 0) {
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

  // Fill by index — no intermediate segment-object array or filter pass (per
  // the package's no-per-iteration-allocation rule for the coverage compute
  // paths).
  //
  // Walking the window rather than the mismatches means segments come out in
  // position order. That is a change only for a caller whose mismatches did not
  // arrive sorted (the alignments pipeline, where they come per read): the
  // segments are the same set, and the stacking within a position is built here
  // either way.
  //
  // Nothing downstream *depends* on the order — but the SVG export snapshots
  // record it, since a painter emits one `<rect>` per segment in the order it
  // reads them, and four of them went red on the switch. They were regenerated
  // as pure reorderings (same element multiset, byte-identical length). Position
  // order is also the better of the two: it does not vary with read arrival, and
  // where two adjacent sub-pixel columns are widened to the 1px floor and
  // overlap, it paints them consistently left to right.
  const positions = new Uint32Array(count)
  const yOffsets = new Float32Array(count)
  const heights = new Float32Array(count)
  const colorTypes = new Uint8Array(count)
  const relDepths = new Float32Array(count)

  let idx = 0
  for (let offset = minOffset; offset <= maxOffset; offset++) {
    const totalDepth = coverageDepths[offset]!
    // A position at zero depth can't host SNPs, so it emits no segment.
    if (totalDepth > 0) {
      const lane = offset * 5
      const relDepth = totalDepth / maxDepth
      // colorType 1=A 2=C 3=G 4=T 5=N, stacked bottom-to-top by accumulating
      // yOffset — which is why the lanes are visited in order.
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

export { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'
