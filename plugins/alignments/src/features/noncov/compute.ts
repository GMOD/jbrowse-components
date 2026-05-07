/**
 * Compute noncov (interbase) coverage segments and per-position indicator
 * data in a single per-position bucket sweep. Returns both arrays so
 * callers (orchestrator) can route indicator data to features/indicator/
 * without redoing the bucket pass.
 */

export interface InsertionEntry {
  position: number
  length: number
  sequence?: string
}

export interface ClipEntry {
  position: number
  length: number
}

const MINIMUM_INDICATOR_READ_DEPTH = 8
const INDICATOR_THRESHOLD = 0.3

export function computeNoncovCoverage(
  insertions: InsertionEntry[],
  softclips: ClipEntry[],
  hardclips: ClipEntry[],
  regionStart: number,
  coverage: { depths: Float32Array; maxDepth: number; startPos: number },
) {
  const {
    depths: coverageDepths,
    maxDepth,
    startPos: coverageStartPos,
  } = coverage
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
    const depthIdx = entry.position - coverageStartPos
    const leftDepth =
      depthIdx - 1 >= 0 ? (coverageDepths[depthIdx - 1] ?? 0) : 0
    const rightDepth =
      depthIdx >= 0 && depthIdx < coverageDepths.length
        ? (coverageDepths[depthIdx] ?? 0)
        : 0
    const localDepth = Math.max(leftDepth, rightDepth)
    if (
      maxDepth >= MINIMUM_INDICATOR_READ_DEPTH &&
      total > localDepth * INDICATOR_THRESHOLD &&
      localDepth >= MINIMUM_INDICATOR_READ_DEPTH
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

  for (let i = 0; i < filteredSegments.length; i++) {
    const seg = filteredSegments[i]!
    positions[i] = seg.position
    yOffsets[i] = seg.yOffset
    heights[i] = seg.height
    colorTypes[i] = seg.colorType
  }

  const indicatorPositions = new Uint32Array(filteredIndicators.length)
  const indicatorColorTypes = new Uint8Array(filteredIndicators.length)
  for (let i = 0; i < filteredIndicators.length; i++) {
    const ind = filteredIndicators[i]!
    indicatorPositions[i] = ind.position
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
