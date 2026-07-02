import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

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

// Maps a depth value to its 0..1 height fraction. The branch is chosen once so
// the returned mapper is total: the log case pre-resolves logMax === 0 (maxDepth
// of 1) to a constant 0 rather than dividing by zero. Mirrors normalizeDepth's
// `logMax <= 0` guard in the shaders.
function makeDepthFraction(maxDepth: number, scaleType: string) {
  if (scaleType === 'log') {
    const logMax = Math.log2(Math.max(1, maxDepth))
    return logMax <= 0
      ? () => 0
      : (value: number) => Math.log2(Math.max(1, value)) / logMax
  }
  return (value: number) => value / maxDepth
}

export function computeCoverageTicks(
  maxDepth: number,
  coverageHeight: number,
  scaleType = 'linear',
): YScaleTicks {
  const yTop = YSCALEBAR_LABEL_OFFSET
  const yBottom = coverageHeight - YSCALEBAR_LABEL_OFFSET

  if (maxDepth === 0) {
    return { items: [], yTop, yBottom }
  }

  const effectiveHeight = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const fractionOf = makeDepthFraction(maxDepth, scaleType)
  const yOf = (value: number) => yBottom - fractionOf(value) * effectiveHeight

  const ticks: YScaleTicks['items'] = []
  if (scaleType === 'log') {
    ticks.push({ value: 1, y: yOf(1) })
    let tick = 2
    while (tick <= maxDepth) {
      ticks.push({ value: tick, y: yOf(tick) })
      tick *= 2
    }
    if (ticks.length < 2) {
      ticks.push({ value: maxDepth, y: yOf(maxDepth) })
    }
  } else if (coverageHeight < 70) {
    ticks.push({ value: 0, y: yOf(0) }, { value: maxDepth, y: yOf(maxDepth) })
  } else {
    const step = niceStep(maxDepth)
    const stepCount = Math.floor(maxDepth / step)
    for (let i = 0; i <= stepCount; i++) {
      ticks.push({ value: i * step, y: yOf(i * step) })
    }
  }

  return { items: ticks, yTop, yBottom }
}

export interface CoverageRegion {
  coverageDepths: Float32Array
  coverageStartPos: number
}

export function computeVisibleCoverageStats<
  B extends { start: number; end: number },
>(
  visibleBlocks: B[],
  getCoverageForBlock: (block: B) => CoverageRegion | undefined,
): ScoreStats | undefined {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  for (const block of visibleBlocks) {
    const cov = getCoverageForBlock(block)
    if (!cov) {
      continue
    }
    const startBin = Math.max(0, Math.floor(block.start - cov.coverageStartPos))
    const endBin = Math.min(
      cov.coverageDepths.length,
      Math.ceil(block.end - cov.coverageStartPos),
    )
    for (let i = startBin; i < endBin; i++) {
      const d = cov.coverageDepths[i]!
      if (d < min) {
        min = d
      }
      if (d > max) {
        max = d
      }
      sum += d
      sumSq += d * d
      count++
    }
  }
  if (count === 0 || !Number.isFinite(max)) {
    return undefined
  }
  const mean = sum / count
  const stdDev = Math.sqrt(Math.max(0, sumSq / count - mean * mean))
  return { scoreMin: min, scoreMax: max, scoreMean: mean, scoreStdDev: stdDev }
}

export interface DownsampledBins {
  // Absolute genomic positions stored as uint32 — exact at 3 Gbp.
  positions: Uint32Array
  mins: Float32Array
  maxs: Float32Array
  count: number
}

// Downsample per-bp depths into min/max bins for faithful peak/valley rendering.
// When depthCount <= targetBins, returns per-bp bins (min=0, max=depth).
// When depthCount > targetBins, aggregates into targetBins bins.
export function downsampleMinMax(
  depths: Float32Array,
  startPos: number,
  targetBins: number,
  globalMaxDepth: number,
): DownsampledBins {
  const n = depths.length
  if (n === 0) {
    return {
      positions: new Uint32Array(0),
      mins: new Float32Array(0),
      maxs: new Float32Array(0),
      count: 0,
    }
  }

  if (n <= targetBins) {
    let count = 0
    for (let i = 0; i < n; i++) {
      if (depths[i]! > 0) {
        count++
      }
    }
    const positions = new Uint32Array(count)
    const mins = new Float32Array(count)
    const maxs = new Float32Array(count)
    let idx = 0
    for (let i = 0; i < n; i++) {
      const d = depths[i]!
      if (d > 0) {
        positions[idx] = startPos + i
        mins[idx] = 0
        maxs[idx] = d / globalMaxDepth
        idx++
      }
    }
    return { positions, mins, maxs, count }
  }

  const bpPerBin = n / targetBins
  const positions = new Uint32Array(targetBins)
  const mins = new Float32Array(targetBins)
  const maxs = new Float32Array(targetBins)
  let count = 0

  for (let b = 0; b < targetBins; b++) {
    const from = Math.floor(b * bpPerBin)
    const to = Math.min(Math.floor((b + 1) * bpPerBin), n)
    let lo = Infinity
    let hi = 0
    for (let i = from; i < to; i++) {
      const d = depths[i]!
      if (d < lo) {
        lo = d
      }
      if (d > hi) {
        hi = d
      }
    }
    if (hi > 0) {
      positions[count] = startPos + from
      mins[count] = (lo === Infinity ? 0 : lo) / globalMaxDepth
      maxs[count] = hi / globalMaxDepth
      count++
    }
  }

  return {
    positions: positions.subarray(0, count),
    mins: mins.subarray(0, count),
    maxs: maxs.subarray(0, count),
    count,
  }
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
  modifications?: Record<
    string,
    {
      count: number
      fwd: number
      rev: number
      probabilityTotal: number
      color: string
      name: string
    }
  >
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

export function countSnpsAtPosition(
  posOffset: number,
  mismatches: MismatchArrays,
) {
  const snps: Record<string, { count: number; fwd: number; rev: number }> = {}
  for (let i = 0; i < mismatches.mismatchPositions.length; i++) {
    if (mismatches.mismatchPositions[i] === posOffset) {
      const base = String.fromCharCode(mismatches.mismatchBases[i]!)
      snps[base] ??= { count: 0, fwd: 0, rev: 0 }
      snps[base].count++
      if (mismatches.mismatchStrands) {
        if (mismatches.mismatchStrands[i] === 1) {
          snps[base].fwd++
        } else {
          snps[base].rev++
        }
      }
    }
  }
  return snps
}

// Genomic position of the first event in [binStart, binEnd) that is
// "significant" — at least `threshold` fraction of the local coverage depth at
// that position. When a pixel spans many bp (zoomed out), an exact-position
// lookup misses the event sitting elsewhere in the bin; callers scan the pixel's
// bp range with this and tooltip the significant position instead. Single pass +
// a small Map keyed by uint32 position. Returns undefined if nothing qualifies.
export function findSignificantInBin(
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartPos: number,
  binStart: number,
  binEnd: number,
  threshold: number,
) {
  const hitsByPos = new Map<number, number>()
  for (const pos of positions) {
    if (pos >= binStart && pos < binEnd) {
      hitsByPos.set(pos, (hitsByPos.get(pos) ?? 0) + 1)
    }
  }
  let best = -1
  for (const [pos, n] of hitsByPos) {
    const binIdx = Math.floor(pos - coverageStartPos)
    const depth = coverageDepths[binIdx]
    if (depth && n / depth > threshold && (best < 0 || pos < best)) {
      best = pos
    }
  }
  return best < 0 ? undefined : best
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
function countInterbaseAtPosition(
  position: number,
  { interbasePositions, interbaseLengths }: InterbaseArrays,
) {
  let count = 0
  let minLen = Infinity
  let maxLen = 0
  let lenSum = 0
  for (let i = 0; i < interbasePositions.length; i++) {
    if (interbasePositions[i] === position) {
      const len = interbaseLengths[i]!
      count++
      lenSum += len
      if (len < minLen) {
        minLen = len
      }
      if (len > maxLen) {
        maxLen = len
      }
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
 * mismatches. Positions left of `regionStart` are dropped, so callers may pass
 * unfiltered arrays.
 */
export function computeSNPCoverage(
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  regionStart: number,
  coverage: { depths: Float32Array; maxDepth: number; startPos: number },
): SNPCoverageResult {
  const {
    depths: coverageDepths,
    maxDepth,
    startPos: coverageStartPos,
  } = coverage
  if (mismatchPositions.length === 0 || maxDepth === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
      relDepths: new Float32Array(0),
      count: 0,
    }
  }

  // Coverage depth at a position is the bar denominator; a position at zero
  // depth can't host SNPs so it emits no segment. Depends only on the position,
  // so it is resolved once when the entry is created and cached on `depth`.
  function depthAt(position: number) {
    const idx = position - coverageStartPos
    return idx >= 0 && idx < coverageDepths.length
      ? (coverageDepths[idx] ?? 0)
      : 0
  }

  const snpByPosition = new Map<
    number,
    {
      position: number
      depth: number
      a: number
      c: number
      g: number
      t: number
      n: number
    }
  >()
  for (let i = 0; i < mismatchPositions.length; i++) {
    const position = mismatchPositions[i]!
    // Positions left of regionStart never emit a segment; dropping them here
    // (rather than filtering the output) lets callers pass unfiltered arrays.
    if (position >= regionStart) {
      let entry = snpByPosition.get(position)
      if (!entry) {
        entry = {
          position,
          depth: depthAt(position),
          a: 0,
          c: 0,
          g: 0,
          t: 0,
          n: 0,
        }
        snpByPosition.set(position, entry)
      }
      // N and other non-A/C/G/T bases (IUPAC ambiguity codes) all accumulate
      // into entry.n, drawn as one grey segment (colorType 5) on the bar.
      switch (mismatchBases[i]) {
        case 65:
          entry.a++
          break
        case 67:
          entry.c++
          break
        case 71:
          entry.g++
          break
        case 84:
          entry.t++
          break
        default:
          entry.n++
      }
    }
  }

  // Pre-size the output typed arrays by counting emitted segments first, then
  // fill by index — no intermediate segment-object array or filter pass (per the
  // package's no-per-iteration-allocation rule for the coverage compute paths).
  let count = 0
  for (const entry of snpByPosition.values()) {
    if (entry.depth > 0) {
      count +=
        (entry.a > 0 ? 1 : 0) +
        (entry.c > 0 ? 1 : 0) +
        (entry.g > 0 ? 1 : 0) +
        (entry.t > 0 ? 1 : 0) +
        (entry.n > 0 ? 1 : 0)
    }
  }

  const positions = new Uint32Array(count)
  const yOffsets = new Float32Array(count)
  const heights = new Float32Array(count)
  const colorTypes = new Uint8Array(count)
  const relDepths = new Float32Array(count)

  let idx = 0
  for (const entry of snpByPosition.values()) {
    const totalDepth = entry.depth
    if (totalDepth > 0) {
      const relDepth = totalDepth / maxDepth
      // colorType 1=A 2=C 3=G 4=T 5=N, stacked bottom-to-top by accumulating
      // yOffset. Unrolled (not a [a,c,g,t] loop) to avoid a per-position array.
      let yOffset = 0
      if (entry.a > 0) {
        const height = entry.a / totalDepth
        positions[idx] = entry.position
        yOffsets[idx] = yOffset
        heights[idx] = height
        colorTypes[idx] = 1
        relDepths[idx] = relDepth
        idx++
        yOffset += height
      }
      if (entry.c > 0) {
        const height = entry.c / totalDepth
        positions[idx] = entry.position
        yOffsets[idx] = yOffset
        heights[idx] = height
        colorTypes[idx] = 2
        relDepths[idx] = relDepth
        idx++
        yOffset += height
      }
      if (entry.g > 0) {
        const height = entry.g / totalDepth
        positions[idx] = entry.position
        yOffsets[idx] = yOffset
        heights[idx] = height
        colorTypes[idx] = 3
        relDepths[idx] = relDepth
        idx++
        yOffset += height
      }
      if (entry.t > 0) {
        const height = entry.t / totalDepth
        positions[idx] = entry.position
        yOffsets[idx] = yOffset
        heights[idx] = height
        colorTypes[idx] = 4
        relDepths[idx] = relDepth
        idx++
        yOffset += height
      }
      if (entry.n > 0) {
        const height = entry.n / totalDepth
        positions[idx] = entry.position
        yOffsets[idx] = yOffset
        heights[idx] = height
        colorTypes[idx] = 5
        relDepths[idx] = relDepth
        idx++
      }
    }
  }

  return { positions, yOffsets, heights, colorTypes, relDepths, count }
}

export { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'
