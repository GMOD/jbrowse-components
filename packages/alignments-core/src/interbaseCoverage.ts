/**
 * Compute interbase coverage segments and per-position indicator data in a
 * single per-position bucket sweep. Returns both arrays so callers can route
 * indicator data to features/indicator/ without redoing the bucket pass.
 */
import { interbaseDepthAt } from './coverageDownsampling.ts'

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

// Buckets in-region entries by position. Out-of-region entries (position <
// regionStart) are dropped here rather than filtered out of the output arrays
// later, so no bucket or segment is ever built for them.
function bumpInterbase(
  map: Map<number, InterbaseBucket>,
  entries: { position: number }[],
  field: InterbaseField,
  regionStart: number,
) {
  for (const { position } of entries) {
    if (position >= regionStart) {
      let bucket = map.get(position)
      if (!bucket) {
        bucket = { position, insertion: 0, softclip: 0, hardclip: 0 }
        map.set(position, bucket)
      }
      bucket[field]++
    }
  }
}

// 0 = not a significant indicator; otherwise the dominant type code
// (1=insertion 2=softclip 3=hardclip). An indicator is emitted only where local
// depth is deep enough and the interbase events exceed a fraction of it.
function indicatorTypeFor(
  entry: InterbaseBucket,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) {
  const total = entry.insertion + entry.softclip + entry.hardclip
  const localDepth = interbaseDepthAt(
    coverageDepths,
    coverageStartPos,
    entry.position,
  )
  let dominantType = 0
  if (
    localDepth >= MINIMUM_INDICATOR_READ_DEPTH &&
    total > localDepth * INDICATOR_THRESHOLD
  ) {
    dominantType = 1
    let dominantCount = entry.insertion
    if (entry.softclip > dominantCount) {
      dominantType = 2
      dominantCount = entry.softclip
    }
    if (entry.hardclip > dominantCount) {
      dominantType = 3
    }
  }
  return dominantType
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
  bumpInterbase(interbaseByPosition, insertions, 'insertion', regionStart)
  bumpInterbase(interbaseByPosition, softclips, 'softclip', regionStart)
  bumpInterbase(interbaseByPosition, hardclips, 'hardclip', regionStart)

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

  // Count pass: one stacked segment per non-empty type per position, plus the
  // significant-indicator count, so the typed arrays are sized exactly and
  // filled by index — no per-segment object allocation in this hot worker path.
  let segmentCount = 0
  let indicatorCount = 0
  for (const entry of interbaseByPosition.values()) {
    if (entry.insertion > 0) {
      segmentCount++
    }
    if (entry.softclip > 0) {
      segmentCount++
    }
    if (entry.hardclip > 0) {
      segmentCount++
    }
    if (indicatorTypeFor(entry, coverageDepths, coverageStartPos) !== 0) {
      indicatorCount++
    }
  }

  const positions = new Uint32Array(segmentCount)
  const yOffsets = new Float32Array(segmentCount)
  const heights = new Float32Array(segmentCount)
  const colorTypes = new Uint8Array(segmentCount)
  const indicatorPositions = new Uint32Array(indicatorCount)
  const indicatorColorTypes = new Uint8Array(indicatorCount)

  let s = 0
  let ind = 0
  for (const entry of interbaseByPosition.values()) {
    // colorType 1=insertion 2=softclip 3=hardclip, stacked by accumulating
    // yOffset. Unrolled to avoid a per-position array allocation.
    let yOffset = 0
    if (entry.insertion > 0) {
      const height = entry.insertion / scale
      positions[s] = entry.position
      yOffsets[s] = yOffset
      heights[s] = height
      colorTypes[s] = 1
      s++
      yOffset += height
    }
    if (entry.softclip > 0) {
      const height = entry.softclip / scale
      positions[s] = entry.position
      yOffsets[s] = yOffset
      heights[s] = height
      colorTypes[s] = 2
      s++
      yOffset += height
    }
    if (entry.hardclip > 0) {
      const height = entry.hardclip / scale
      positions[s] = entry.position
      yOffsets[s] = yOffset
      heights[s] = height
      colorTypes[s] = 3
      s++
    }
    const dominantType = indicatorTypeFor(
      entry,
      coverageDepths,
      coverageStartPos,
    )
    if (dominantType !== 0) {
      indicatorPositions[ind] = entry.position
      indicatorColorTypes[ind] = dominantType
      ind++
    }
  }

  return {
    positions,
    yOffsets,
    heights,
    colorTypes,
    indicatorPositions,
    indicatorColorTypes,
    maxCount: scale,
    segmentCount,
    indicatorCount,
  }
}
