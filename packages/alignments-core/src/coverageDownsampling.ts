import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'

import type { IndelEntry } from './labelConstants.ts'
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

export function computeCoverageTicks(
  maxDepth: number,
  coverageHeight: number,
  scaleType = 'linear',
): YScaleTicks {
  const yTop = YSCALEBAR_LABEL_OFFSET
  const yBottom = coverageHeight - YSCALEBAR_LABEL_OFFSET

  if (maxDepth === 0) {
    return { ticks: [], yTop, yBottom }
  }

  const effectiveHeight = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const logMax = Math.log2(Math.max(1, maxDepth))
  const yOf =
    scaleType === 'log'
      ? (value: number) =>
          yBottom - (Math.log2(Math.max(1, value)) / logMax) * effectiveHeight
      : (value: number) => yBottom - (value / maxDepth) * effectiveHeight

  const ticks: YScaleTicks['ticks'] = []
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

  return { ticks, yTop, yBottom }
}

export interface CoverageRegion {
  coverageDepths: Float32Array
  coverageStartPos: number
}

export function computeVisibleMaxDepth<
  B extends { start: number; end: number },
>(
  visibleBlocks: B[],
  getCoverageForBlock: (block: B) => CoverageRegion | undefined,
) {
  let maxDepth = 0
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
      if (d > maxDepth) {
        maxDepth = d
      }
    }
  }
  return maxDepth
}

export function getGlobalMaxCoverageDepth<K, D>(
  dataMap: ReadonlyMap<K, D>,
  getMaxDepth: (data: D) => number,
) {
  let max = 0
  for (const data of dataMap.values()) {
    const d = getMaxDepth(data)
    if (d > max) {
      max = d
    }
  }
  return max
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

export function computeGlobalCoverageStats<K, D>(
  dataMap: ReadonlyMap<K, D>,
  getCoverage: (data: D) => CoverageRegion | undefined,
): ScoreStats | undefined {
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  for (const data of dataMap.values()) {
    const cov = getCoverage(data)
    if (!cov) {
      continue
    }
    for (let i = 0, l = cov.coverageDepths.length; i < l; i++) {
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

export function buildCoverageTooltipBin(
  position: number,
  coverage: CoverageArrays,
  mismatches: MismatchArrays,
): CoverageTooltipBin | undefined {
  const binIdx = Math.floor(position - coverage.coverageStartPos)
  const depth = coverage.coverageDepths[binIdx] ?? 0
  if (depth === 0) {
    return undefined
  }
  const snps = countSnpsAtPosition(position, mismatches)
  return {
    position,
    depth,
    interbaseDepth: 0,
    snps,
    interbase: {},
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
 * Groups mismatches by position, counts A/C/G/T per position, and creates
 * stacked segments expressed as fractions of THIS position's coverage bar.
 */
export function computeSNPCoverage(
  mismatches: MismatchEntry[],
  regionStart: number,
  coverage: { depths: Float32Array; maxDepth: number; startPos: number },
): SNPCoverageResult {
  const { depths: coverageDepths, maxDepth, startPos: coverageStartPos } =
    coverage
  if (mismatches.length === 0 || maxDepth === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
      relDepths: new Float32Array(0),
      count: 0,
    }
  }

  const snpByPosition = new Map<
    number,
    { position: number; a: number; c: number; g: number; t: number }
  >()
  for (const mm of mismatches) {
    let entry = snpByPosition.get(mm.position)
    if (!entry) {
      entry = { position: mm.position, a: 0, c: 0, g: 0, t: 0 }
      snpByPosition.set(mm.position, entry)
    }
    if (mm.base === 65) {
      entry.a++
    } else if (mm.base === 67) {
      entry.c++
    } else if (mm.base === 71) {
      entry.g++
    } else if (mm.base === 84) {
      entry.t++
    }
  }

  const segments: {
    position: number
    yOffset: number
    height: number
    colorType: number
    relDepth: number
  }[] = []

  for (const entry of snpByPosition.values()) {
    const total = entry.a + entry.c + entry.g + entry.t
    if (total === 0) {
      continue
    }
    // totalDepth at this position determines bar height; SNP fractions are
    // counts / totalDepth so they fill the visible part of the bar correctly.
    // Skip positions outside coverage or with zero depth — there can't be
    // SNPs without reads, so this is a data-inconsistency guard.
    const idx = entry.position - coverageStartPos
    const totalDepth =
      idx >= 0 && idx < coverageDepths.length
        ? (coverageDepths[idx] ?? 0)
        : 0
    if (totalDepth === 0) {
      continue
    }
    const relDepth = totalDepth / maxDepth
    let yOffset = 0
    if (entry.a > 0) {
      const h = entry.a / totalDepth
      segments.push({ position: entry.position, yOffset, height: h, colorType: 1, relDepth })
      yOffset += h
    }
    if (entry.c > 0) {
      const h = entry.c / totalDepth
      segments.push({ position: entry.position, yOffset, height: h, colorType: 2, relDepth })
      yOffset += h
    }
    if (entry.g > 0) {
      const h = entry.g / totalDepth
      segments.push({ position: entry.position, yOffset, height: h, colorType: 3, relDepth })
      yOffset += h
    }
    if (entry.t > 0) {
      const h = entry.t / totalDepth
      segments.push({ position: entry.position, yOffset, height: h, colorType: 4, relDepth })
    }
  }

  const filteredSegments = segments.filter(seg => seg.position >= regionStart)
  const positions = new Uint32Array(filteredSegments.length)
  const yOffsets = new Float32Array(filteredSegments.length)
  const heights = new Float32Array(filteredSegments.length)
  const colorTypes = new Uint8Array(filteredSegments.length)
  const relDepths = new Float32Array(filteredSegments.length)

  for (const [i, seg] of filteredSegments.entries()) {
    positions[i] = seg.position
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
    relDepths[i] = seg.relDepth
  }

  return {
    positions,
    yOffsets,
    heights,
    colorTypes,
    relDepths,
    count: filteredSegments.length,
  }
}

export interface InsertionIndicatorResult {
  positions: Uint32Array
  count: number
}

/**
 * Compute insertion indicator positions from CS tag indel events.
 * Only insertions produce indicators — deletions already show as reduced
 * depth in the coverage area. Creates an indicator when the insertion count
 * at a position exceeds `threshold` fraction of the local coverage depth.
 */
export function computeInsertionIndicators(
  indels: IndelEntry[],
  coverageDepths: Float32Array,
  coverageStartPos: number,
  threshold = 0.15,
): InsertionIndicatorResult {
  if (indels.length === 0) {
    return { positions: new Uint32Array(0), count: 0 }
  }

  const insertionCountByPos = new Map<number, number>()
  for (const indel of indels) {
    if (indel.type === 1) {
      insertionCountByPos.set(
        indel.position,
        (insertionCountByPos.get(indel.position) ?? 0) + 1,
      )
    }
  }

  const resultPositions: number[] = []
  for (const [pos, count] of insertionCountByPos) {
    const depthIdx = pos - coverageStartPos
    const localDepth =
      depthIdx >= 0 && depthIdx < coverageDepths.length
        ? coverageDepths[depthIdx]!
        : 0
    if (localDepth >= 1 && count / localDepth >= threshold) {
      resultPositions.push(pos)
    }
  }

  resultPositions.sort((a, b) => a - b)

  const positions = new Uint32Array(resultPositions.length)
  for (let i = 0; i < resultPositions.length; i++) {
    positions[i] = resultPositions[i]!
  }

  return { positions, count: resultPositions.length }
}

export { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'
