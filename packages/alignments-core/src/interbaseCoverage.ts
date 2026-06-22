/**
 * Compute interbase coverage segments and per-position indicator data in a
 * single per-position bucket sweep. Returns both arrays so callers can route
 * indicator data to features/indicator/ without redoing the bucket pass.
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

interface InterbaseBucket {
  position: number
  insertion: number
  softclip: number
  hardclip: number
}

type InterbaseField = 'insertion' | 'softclip' | 'hardclip'

function bumpInterbase(
  map: Map<number, InterbaseBucket>,
  entries: { position: number }[],
  field: InterbaseField,
) {
  for (const { position } of entries) {
    let bucket = map.get(position)
    if (!bucket) {
      bucket = { position, insertion: 0, softclip: 0, hardclip: 0 }
      map.set(position, bucket)
    }
    bucket[field]++
  }
}

export function computeInterbaseCoverage(
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
  const interbaseByPosition = new Map<number, InterbaseBucket>()
  bumpInterbase(interbaseByPosition, insertions, 'insertion')
  bumpInterbase(interbaseByPosition, softclips, 'softclip')
  bumpInterbase(interbaseByPosition, hardclips, 'hardclip')

  if (interbaseByPosition.size === 0) {
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

  for (const entry of interbaseByPosition.values()) {
    const total = entry.insertion + entry.softclip + entry.hardclip
    // colorType 1=insertion 2=softclip 3=hardclip, stacked by accumulating
    // yOffset. Unrolled to avoid a per-position array allocation.
    let yOffset = 0
    if (entry.insertion > 0) {
      const height = entry.insertion / scale
      segments.push({
        position: entry.position,
        yOffset,
        height,
        colorType: 1,
      })
      yOffset += height
    }
    if (entry.softclip > 0) {
      const height = entry.softclip / scale
      segments.push({
        position: entry.position,
        yOffset,
        height,
        colorType: 2,
      })
      yOffset += height
    }
    if (entry.hardclip > 0) {
      const height = entry.hardclip / scale
      segments.push({
        position: entry.position,
        yOffset,
        height,
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
    // localDepth <= maxDepth always (it's drawn from coverageDepths, maxDepth
    // is their max), so a separate maxDepth >= MIN check would be redundant.
    const localDepth = Math.max(leftDepth, rightDepth)
    if (
      localDepth >= MINIMUM_INDICATOR_READ_DEPTH &&
      total > localDepth * INDICATOR_THRESHOLD
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
