export const YSCALEBAR_LABEL_OFFSET = 5

export interface CoverageTicks {
  ticks: { value: number; y: number }[]
  height: number
  maxDepth: number
  yTop: number
  yBottom: number
}

export function computeCoverageTicks(
  maxDepth: number,
  coverageHeight: number,
): CoverageTicks {
  const effectiveHeight = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET

  const numTicks = coverageHeight < 70 ? 2 : 4
  const tickStep = maxDepth / (numTicks - 1)
  const ticks: { value: number; y: number }[] = []
  for (let i = 0; i < numTicks; i++) {
    const value = Math.round(i * tickStep)
    const y =
      coverageHeight -
      YSCALEBAR_LABEL_OFFSET -
      (value / maxDepth) * effectiveHeight
    ticks.push({ value, y })
  }

  return {
    ticks,
    height: coverageHeight,
    maxDepth,
    yTop: YSCALEBAR_LABEL_OFFSET,
    yBottom: coverageHeight - YSCALEBAR_LABEL_OFFSET,
  }
}

export interface CoverageRegion {
  coverageDepths: Float32Array
  coverageStartOffset: number
  regionStart: number
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
    const startBin = Math.max(
      0,
      Math.floor(block.start - cov.regionStart - cov.coverageStartOffset),
    )
    const endBin = Math.min(
      cov.coverageDepths.length,
      Math.ceil(block.end - cov.regionStart - cov.coverageStartOffset),
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
  dataMap: Map<K, D>,
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

export interface DownsampledBins {
  positions: Float32Array
  mins: Float32Array
  maxs: Float32Array
  count: number
}

// Downsample per-bp depths into min/max bins for faithful peak/valley rendering.
// When depthCount <= targetBins, returns per-bp bins (min=0, max=depth).
// When depthCount > targetBins, aggregates into targetBins bins.
export function downsampleMinMax(
  depths: Float32Array,
  startOffset: number,
  targetBins: number,
  globalMaxDepth: number,
): DownsampledBins {
  const n = depths.length
  if (n === 0) {
    return {
      positions: new Float32Array(0),
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
    const positions = new Float32Array(count)
    const mins = new Float32Array(count)
    const maxs = new Float32Array(count)
    let idx = 0
    for (let i = 0; i < n; i++) {
      const d = depths[i]!
      if (d > 0) {
        positions[idx] = startOffset + i
        mins[idx] = 0
        maxs[idx] = d / globalMaxDepth
        idx++
      }
    }
    return { positions, mins, maxs, count }
  }

  const bpPerBin = n / targetBins
  const positions = new Float32Array(targetBins)
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
      positions[count] = startOffset + from
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
  numMismatches: number
}

export interface CoverageArrays {
  coverageDepths: Float32Array
  coverageStartOffset: number
  regionStart: number
}

export function countSnpsAtPosition(
  posOffset: number,
  mismatches: MismatchArrays,
) {
  const snps: Record<string, { count: number; fwd: number; rev: number }> = {}
  for (let i = 0; i < mismatches.numMismatches; i++) {
    if (mismatches.mismatchPositions[i] === posOffset) {
      const base = String.fromCharCode(mismatches.mismatchBases[i]!)
      if (!snps[base]) {
        snps[base] = { count: 0, fwd: 0, rev: 0 }
      }
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
  const posOffset = position - coverage.regionStart
  const binIdx = Math.floor(posOffset - coverage.coverageStartOffset)
  const depth = coverage.coverageDepths[binIdx] ?? 0
  if (depth === 0) {
    return undefined
  }
  const snps = countSnpsAtPosition(posOffset, mismatches)
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
  yOffsets: Float32Array
  heights: Float32Array
  colorTypes: Uint8Array
  count: number
}

/**
 * Compute SNP coverage segments for rendering colored bars in coverage area.
 * Groups mismatches by position, counts A/C/G/T per position, and creates
 * stacked segments normalized by maxDepth.
 */
export function computeSNPCoverage(
  mismatches: MismatchEntry[],
  maxDepth: number,
  regionStart: number,
): SNPCoverageResult {
  if (mismatches.length === 0 || maxDepth === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
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
  }[] = []

  for (const entry of snpByPosition.values()) {
    const total = entry.a + entry.c + entry.g + entry.t
    if (total === 0) {
      continue
    }
    let yOffset = 0
    if (entry.a > 0) {
      segments.push({
        position: entry.position,
        yOffset,
        height: entry.a / maxDepth,
        colorType: 1,
      })
      yOffset += entry.a / maxDepth
    }
    if (entry.c > 0) {
      segments.push({
        position: entry.position,
        yOffset,
        height: entry.c / maxDepth,
        colorType: 2,
      })
      yOffset += entry.c / maxDepth
    }
    if (entry.g > 0) {
      segments.push({
        position: entry.position,
        yOffset,
        height: entry.g / maxDepth,
        colorType: 3,
      })
      yOffset += entry.g / maxDepth
    }
    if (entry.t > 0) {
      segments.push({
        position: entry.position,
        yOffset,
        height: entry.t / maxDepth,
        colorType: 4,
      })
    }
  }

  const filteredSegments = segments.filter(seg => seg.position >= regionStart)
  const positions = new Uint32Array(filteredSegments.length)
  const yOffsets = new Float32Array(filteredSegments.length)
  const heights = new Float32Array(filteredSegments.length)
  const colorTypes = new Uint8Array(filteredSegments.length)

  for (const [i, seg] of filteredSegments.entries()) {
    positions[i] = seg.position - regionStart
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
  }

  return {
    positions,
    yOffsets,
    heights,
    colorTypes,
    count: filteredSegments.length,
  }
}

import type { IndelEntry } from './labelConstants.ts'

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
  coverageStartOffset: number,
  regionStart: number,
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
    const depthIdx = pos - regionStart - coverageStartOffset
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
    positions[i] = resultPositions[i]! - regionStart
  }

  return { positions, count: resultPositions.length }
}
