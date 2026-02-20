/**
 * Shared coverage computation functions used by pileup, chain, and arcs RPCs.
 *
 * COORDINATE SYSTEM: All positions are absolute genomic coordinates.
 * Callers convert to offsets from regionStart when building typed arrays.
 */

export interface CoverageFeature {
  start: number
  end: number
  strand?: number
}

export interface CoverageGap {
  start: number
  end: number
  type: 'deletion' | 'skip'
  strand: number
  featureStrand: number
}

export interface MismatchEntry {
  position: number
  base: number // ASCII code
  strand: number
}

export interface InsertionEntry {
  position: number
  length: number
  sequence?: string
}

export interface ClipEntry {
  position: number
  length: number
}

/**
 * Compute extent of features beyond the requested region, limited to
 * 1x extension on each side to avoid pathological cases
 */
export function getFeatureExtent(
  features: { start: number; end: number }[],
  regionStart: number,
  regionEnd: number,
) {
  const maxExtension = regionEnd - regionStart
  let actualStart = regionStart
  let actualEnd = regionEnd
  for (const f of features) {
    if (f.start < actualStart && f.start >= regionStart - maxExtension) {
      actualStart = f.start
    }
    if (f.end > actualEnd && f.end <= regionEnd + maxExtension) {
      actualEnd = f.end
    }
  }
  return { actualStart, actualEnd }
}

/**
 * Compute coverage depth across a region using sweep-line algorithm
 */
export function computeCoverage(
  features: CoverageFeature[],
  gaps: CoverageGap[],
  regionStart: number,
  regionEnd: number,
  trackStrands?: boolean,
) {
  if (features.length === 0) {
    return {
      depths: new Float32Array(0),
      fwdDepths: undefined as Float32Array | undefined,
      revDepths: undefined as Float32Array | undefined,
      maxDepth: 0,
      binSize: 1,
      startOffset: 0,
    }
  }

  const { actualStart, actualEnd } = getFeatureExtent(
    features,
    regionStart,
    regionEnd,
  )

  const startOffset = actualStart - regionStart
  const regionLength = actualEnd - actualStart
  const binSize = 1
  const numBins = regionLength

  const events: { pos: number; delta: number }[] = []
  for (const f of features) {
    events.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
  }
  for (const g of gaps) {
    events.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
  }
  events.sort((a, b) => a.pos - b.pos)

  const depths = new Float32Array(numBins)
  let currentDepth = 0
  let maxDepth = 0
  let eventIdx = 0

  for (let binIdx = 0; binIdx < numBins; binIdx++) {
    const binEnd = actualStart + (binIdx + 1) * binSize
    while (eventIdx < events.length && events[eventIdx]!.pos < binEnd) {
      currentDepth += events[eventIdx]!.delta
      eventIdx++
    }
    depths[binIdx] = currentDepth
    if (currentDepth > maxDepth) {
      maxDepth = currentDepth
    }
  }

  let fwdDepths: Float32Array | undefined
  let revDepths: Float32Array | undefined
  if (trackStrands) {
    const fwdEvents: { pos: number; delta: number }[] = []
    const revEvents: { pos: number; delta: number }[] = []
    for (const f of features) {
      const s = f.strand ?? 0
      if (s === 1) {
        fwdEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
      } else if (s === -1) {
        revEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
      } else {
        fwdEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
        revEvents.push({ pos: f.start, delta: 1 }, { pos: f.end, delta: -1 })
      }
    }
    for (const g of gaps) {
      if (g.featureStrand === 1) {
        fwdEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
      } else if (g.featureStrand === -1) {
        revEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
      } else {
        fwdEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
        revEvents.push({ pos: g.start, delta: -1 }, { pos: g.end, delta: 1 })
      }
    }
    fwdEvents.sort((a, b) => a.pos - b.pos)
    revEvents.sort((a, b) => a.pos - b.pos)

    fwdDepths = new Float32Array(numBins)
    revDepths = new Float32Array(numBins)

    let fwdDepth = 0
    let fwdIdx = 0
    let revDepth = 0
    let revIdx = 0
    for (let binIdx = 0; binIdx < numBins; binIdx++) {
      const binEnd = actualStart + (binIdx + 1) * binSize
      while (fwdIdx < fwdEvents.length && fwdEvents[fwdIdx]!.pos < binEnd) {
        fwdDepth += fwdEvents[fwdIdx]!.delta
        fwdIdx++
      }
      while (revIdx < revEvents.length && revEvents[revIdx]!.pos < binEnd) {
        revDepth += revEvents[revIdx]!.delta
        revIdx++
      }
      fwdDepths[binIdx] = Math.max(0, fwdDepth)
      revDepths[binIdx] = Math.max(0, revDepth)
    }
  }

  return {
    depths,
    fwdDepths,
    revDepths,
    maxDepth: maxDepth || 1,
    binSize,
    startOffset,
  }
}

/**
 * Compute per-mismatch frequency (base count at position / total depth).
 * Used by the shader to fade low-frequency SNPs when zoomed out.
 */
export function computeMismatchFrequencies(
  mismatchPositions: Uint32Array,
  mismatchBases: Uint8Array,
  coverageDepths: Float32Array,
  coverageStartOffset: number,
) {
  const n = mismatchPositions.length
  const frequencies = new Uint8Array(n)
  const posBaseCounts = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const key = mismatchPositions[i]! * 256 + mismatchBases[i]!
    posBaseCounts.set(key, (posBaseCounts.get(key) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const posOffset = mismatchPositions[i]!
    const depthIdx = posOffset - coverageStartOffset
    const depth =
      depthIdx >= 0 && depthIdx < coverageDepths.length
        ? coverageDepths[depthIdx]!
        : 1
    const key = posOffset * 256 + mismatchBases[i]!
    const count = posBaseCounts.get(key) ?? 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

/**
 * Compute per-position frequency (count at position / total depth) for point
 * features like insertions, softclips, hardclips. For paired position data
 * (gaps), pass the start positions only.
 */
export function computePositionFrequencies(
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartOffset: number,
) {
  const n = positions.length
  const frequencies = new Uint8Array(n)
  const posCounts = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    const pos = positions[i]!
    posCounts.set(pos, (posCounts.get(pos) ?? 0) + 1)
  }
  for (let i = 0; i < n; i++) {
    const posOffset = positions[i]!
    const depthIdx = posOffset - coverageStartOffset
    const depth =
      depthIdx >= 0 && depthIdx < coverageDepths.length
        ? coverageDepths[depthIdx]!
        : 1
    const count = posCounts.get(posOffset) ?? 1
    const freq = depth > 0 ? count / depth : 0
    frequencies[i] = Math.min(255, Math.round(freq * 255))
  }
  return frequencies
}

export function applyDepthDependentThreshold(
  frequencies: Uint8Array,
  positions: Uint32Array,
  coverageDepths: Float32Array,
  coverageStartOffset: number,
  thresholdFn: (depth: number) => number,
) {
  for (let i = 0; i < frequencies.length; i++) {
    const posOffset = positions[i]!
    const depthIdx = posOffset - coverageStartOffset
    const depth =
      depthIdx >= 0 && depthIdx < coverageDepths.length
        ? coverageDepths[depthIdx]!
        : 0
    const freq = frequencies[i]! / 255
    if (freq < thresholdFn(depth)) {
      frequencies[i] = 0
    }
  }
}

/**
 * Compute SNP coverage segments for rendering colored bars in coverage area
 */
export function computeSNPCoverage(
  mismatches: MismatchEntry[],
  maxDepth: number,
  regionStart: number,
) {
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

const MINIMUM_INDICATOR_READ_DEPTH = 7
const INDICATOR_THRESHOLD = 0.3

/**
 * Compute noncov (interbase) coverage - insertion/softclip/hardclip counts
 */
export function computeNoncovCoverage(
  insertions: InsertionEntry[],
  softclips: ClipEntry[],
  hardclips: ClipEntry[],
  maxDepth: number,
  regionStart: number,
) {
  const noncovByPosition = new Map<
    number,
    { position: number; insertion: number; softclip: number; hardclip: number }
  >()

  for (const ins of insertions) {
    let entry = noncovByPosition.get(ins.position)
    if (!entry) {
      entry = { position: ins.position, insertion: 0, softclip: 0, hardclip: 0 }
      noncovByPosition.set(ins.position, entry)
    }
    entry.insertion++
  }
  for (const sc of softclips) {
    let entry = noncovByPosition.get(sc.position)
    if (!entry) {
      entry = { position: sc.position, insertion: 0, softclip: 0, hardclip: 0 }
      noncovByPosition.set(sc.position, entry)
    }
    entry.softclip++
  }
  for (const hc of hardclips) {
    let entry = noncovByPosition.get(hc.position)
    if (!entry) {
      entry = { position: hc.position, insertion: 0, softclip: 0, hardclip: 0 }
      noncovByPosition.set(hc.position, entry)
    }
    entry.hardclip++
  }

  if (noncovByPosition.size === 0) {
    return {
      positions: new Uint32Array(0),
      yOffsets: new Float32Array(0),
      heights: new Float32Array(0),
      colorTypes: new Uint8Array(0),
      indicatorPositions: new Uint32Array(0),
      indicatorColorTypes: new Uint8Array(0),
      maxCount: 0,
      segmentCount: 0,
      indicatorCount: 0,
    }
  }

  const scale = Math.max(maxDepth, 1)

  const segments: {
    position: number
    yOffset: number
    height: number
    colorType: number
  }[] = []
  const indicators: { position: number; colorType: number }[] = []

  for (const entry of noncovByPosition.values()) {
    const total = entry.insertion + entry.softclip + entry.hardclip
    if (total === 0) {
      continue
    }
    let yOffset = 0
    if (entry.insertion > 0) {
      segments.push({
        position: entry.position,
        yOffset,
        height: entry.insertion / scale,
        colorType: 1,
      })
      yOffset += entry.insertion / scale
    }
    if (entry.softclip > 0) {
      segments.push({
        position: entry.position,
        yOffset,
        height: entry.softclip / scale,
        colorType: 2,
      })
      yOffset += entry.softclip / scale
    }
    if (entry.hardclip > 0) {
      segments.push({
        position: entry.position,
        yOffset,
        height: entry.hardclip / scale,
        colorType: 3,
      })
    }
    if (
      maxDepth >= MINIMUM_INDICATOR_READ_DEPTH &&
      total > maxDepth * INDICATOR_THRESHOLD
    ) {
      let dominantType = 1
      let dominantCount = entry.insertion
      if (entry.softclip > dominantCount) {
        dominantType = 2
        dominantCount = entry.softclip
      }
      if (entry.hardclip > dominantCount) {
        dominantType = 3
      }
      indicators.push({ position: entry.position, colorType: dominantType })
    }
  }

  const filteredSegments = segments.filter(seg => seg.position >= regionStart)
  const filteredIndicators = indicators.filter(
    ind => ind.position >= regionStart,
  )

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

  const indicatorPositions = new Uint32Array(filteredIndicators.length)
  const indicatorColorTypes = new Uint8Array(filteredIndicators.length)
  for (const [i, ind] of filteredIndicators.entries()) {
    indicatorPositions[i] = ind.position - regionStart
    indicatorColorTypes[i] = ind.colorType
  }

  return {
    positions,
    yOffsets,
    heights,
    colorTypes,
    indicatorPositions,
    indicatorColorTypes,
    maxCount: scale,
    segmentCount: filteredSegments.length,
    indicatorCount: filteredIndicators.length,
  }
}

/**
 * Compute sashimi junction arcs from skip gaps
 */
export function computeSashimiJunctions(
  gaps: CoverageGap[],
  regionStart: number,
) {
  const junctions = new Map<
    string,
    { start: number; end: number; fwd: number; rev: number }
  >()

  for (const gap of gaps) {
    if (gap.type !== 'skip') {
      continue
    }
    const key = `${gap.start}:${gap.end}`
    let j = junctions.get(key)
    if (!j) {
      j = { start: gap.start, end: gap.end, fwd: 0, rev: 0 }
      junctions.set(key, j)
    }
    if (gap.strand === 1) {
      j.fwd++
    } else {
      j.rev++
    }
  }

  const arcs: {
    start: number
    end: number
    count: number
    colorType: number
  }[] = []
  for (const j of junctions.values()) {
    if (j.fwd > 0) {
      arcs.push({ start: j.start, end: j.end, count: j.fwd, colorType: 0 })
    }
    if (j.rev > 0) {
      arcs.push({ start: j.start, end: j.end, count: j.rev, colorType: 1 })
    }
  }

  const n = arcs.length
  const sashimiX1 = new Float32Array(n)
  const sashimiX2 = new Float32Array(n)
  const sashimiScores = new Float32Array(n)
  const sashimiColorTypes = new Uint8Array(n)
  const sashimiCounts = new Uint32Array(n)

  for (let i = 0; i < n; i++) {
    const arc = arcs[i]!
    sashimiX1[i] = arc.start - regionStart
    sashimiX2[i] = arc.end - regionStart
    sashimiScores[i] = Math.log(arc.count + 1)
    sashimiColorTypes[i] = arc.colorType
    sashimiCounts[i] = arc.count
  }

  return {
    sashimiX1,
    sashimiX2,
    sashimiScores,
    sashimiColorTypes,
    sashimiCounts,
    numSashimiArcs: n,
  }
}
