/**
 * Compute the interbase histogram's stacked segments and the indicator
 * triangles in a single per-position bucket sweep, emitting both as the packed
 * instance buffers the shaders and the Canvas2D draw read.
 *
 * The buffers ARE the representation: there is no parallel-typed-array form of
 * these segments any more. They used to be built as four arrays, copied into
 * the packed buffer, and then both shipped — 29 bytes a segment across the RPC
 * boundary for 16 that anything read, and two spellings of the same record for
 * a reader to pick the wrong one of. `interbaseSegments.ts` is the decode side,
 * used by the hit test and by tests.
 */
import { interbaseDepthAt } from './coverageDownsampling.ts'
import {
  INSTANCE_OFFSET_F32 as INDICATOR_F32,
  INSTANCE_OFFSET_U32 as INDICATOR_U32,
  INSTANCE_STRIDE_BYTES as INDICATOR_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as INDICATOR_STRIDE,
} from './indicatorLayout.generated.ts'
import {
  INSTANCE_OFFSET_F32 as SEGMENT_F32,
  INSTANCE_OFFSET_U32 as SEGMENT_U32,
  INSTANCE_STRIDE_BYTES as SEGMENT_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as SEGMENT_STRIDE,
} from './interbaseHistogramLayout.generated.ts'

export interface InsertionEntry {
  position: number
  length: number
  sequence?: string
}

export interface ClipEntry {
  position: number
  length: number
}

// The gate an interbase column has to clear to earn an indicator triangle.
// Exported because the R export emits them as editable script variables and
// passes them to its own `interbase_indicators` — a second copy of either number
// would be a silent disagreement between the figure and the browser it claims to
// reproduce, visible only as a triangle that is there in one and not the other.
export const MINIMUM_INDICATOR_READ_DEPTH = 8
export const INDICATOR_THRESHOLD = 0.3

interface InterbaseBucket {
  insertion: number
  softclip: number
  hardclip: number
  // Filled by the count pass below, read by the fill pass: 0 = not significant,
  // else the dominant type code. Kept on the bucket because classifying costs a
  // coverage-depth lookup per position and both passes need the answer.
  indicatorType: number
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
        bucket = { insertion: 0, softclip: 0, hardclip: 0, indicatorType: 0 }
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
  position: number,
  coverageDepths: Float32Array,
  coverageStartPos: number,
) {
  const total = entry.insertion + entry.softclip + entry.hardclip
  const localDepth = interbaseDepthAt(
    coverageDepths,
    coverageStartPos,
    position,
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

function emptyResult() {
  return {
    interbasePackedBuffer: new ArrayBuffer(0),
    indicatorPackedBuffer: new ArrayBuffer(0),
    maxCount: 0,
    segmentCount: 0,
    indicatorCount: 0,
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
  bumpInterbase(interbaseByPosition, insertions, 'insertion', regionStart)
  bumpInterbase(interbaseByPosition, softclips, 'softclip', regionStart)
  bumpInterbase(interbaseByPosition, hardclips, 'hardclip', regionStart)

  if (interbaseByPosition.size === 0) {
    return emptyResult()
  }

  const scale = Math.max(maxDepth, 1)

  // Ascending genomic order, which the Map's own iteration (first-bump order,
  // i.e. read order) is not. Two readers want it: the hit test binary-searches
  // these positions on every mousemove instead of scanning them twice, and the
  // draw walks the buffer in screen order. It also makes the output a function
  // of the data rather than of the order reads happened to arrive in.
  const orderedPositions = new Uint32Array(interbaseByPosition.keys()).sort()

  // Count pass: one stacked segment per non-empty type per position, plus the
  // significant-indicator count, so the buffers are sized exactly and filled by
  // index. The indicator classification is banked on the bucket rather than
  // recomputed in the fill pass: it is a coverage-depth lookup per interbase
  // position, and running it twice made this the only quantity in the function
  // derived twice.
  let segmentCount = 0
  let indicatorCount = 0
  for (let i = 0; i < orderedPositions.length; i++) {
    const position = orderedPositions[i]!
    const entry = interbaseByPosition.get(position)!
    if (entry.insertion > 0) {
      segmentCount++
    }
    if (entry.softclip > 0) {
      segmentCount++
    }
    if (entry.hardclip > 0) {
      segmentCount++
    }
    entry.indicatorType = indicatorTypeFor(
      entry,
      position,
      coverageDepths,
      coverageStartPos,
    )
    if (entry.indicatorType !== 0) {
      indicatorCount++
    }
  }

  const interbasePackedBuffer = new ArrayBuffer(
    segmentCount * SEGMENT_STRIDE_BYTES,
  )
  const segU32 = new Uint32Array(interbasePackedBuffer)
  const segF32 = new Float32Array(interbasePackedBuffer)
  const indicatorPackedBuffer = new ArrayBuffer(
    indicatorCount * INDICATOR_STRIDE_BYTES,
  )
  const indU32 = new Uint32Array(indicatorPackedBuffer)
  const indF32 = new Float32Array(indicatorPackedBuffer)

  let s = 0
  let ind = 0
  for (let i = 0; i < orderedPositions.length; i++) {
    const position = orderedPositions[i]!
    const entry = interbaseByPosition.get(position)!
    // colorType 1=insertion 2=softclip 3=hardclip, stacked by accumulating
    // yOffset. Unrolled to avoid a per-position array allocation. A position's
    // segments are written consecutively, which the hit test's stack walk
    // relies on to be O(3) rather than O(segments).
    //
    // Indices are inline against the generated per-view offset maps, NOT the
    // generated `setInstance<Field>` accessors: those measured 0.46x on this
    // loop's shape (`benches/instanceAccessors.bench.ts`, control 1.02). The
    // cost is the call, not the arithmetic — an accessor taking a hoisted word
    // offset measured no better. The maps still bind each field to a view, so
    // `segF32[o + SEGMENT_U32.position]` is the residual mistake available
    // here, and it is one line from the buffer it writes.
    let yOffset = 0
    if (entry.insertion > 0) {
      const height = entry.insertion / scale
      const o = s++ * SEGMENT_STRIDE
      segU32[o + SEGMENT_U32.position] = position
      segF32[o + SEGMENT_F32.yOffset] = yOffset
      segF32[o + SEGMENT_F32.segHeight] = height
      segF32[o + SEGMENT_F32.colorType] = 1
      yOffset += height
    }
    if (entry.softclip > 0) {
      const height = entry.softclip / scale
      const o = s++ * SEGMENT_STRIDE
      segU32[o + SEGMENT_U32.position] = position
      segF32[o + SEGMENT_F32.yOffset] = yOffset
      segF32[o + SEGMENT_F32.segHeight] = height
      segF32[o + SEGMENT_F32.colorType] = 2
      yOffset += height
    }
    if (entry.hardclip > 0) {
      const o = s++ * SEGMENT_STRIDE
      segU32[o + SEGMENT_U32.position] = position
      segF32[o + SEGMENT_F32.yOffset] = yOffset
      segF32[o + SEGMENT_F32.segHeight] = entry.hardclip / scale
      segF32[o + SEGMENT_F32.colorType] = 3
    }
    if (entry.indicatorType !== 0) {
      const o = ind++ * INDICATOR_STRIDE
      indU32[o + INDICATOR_U32.position] = position
      indF32[o + INDICATOR_F32.colorType] = entry.indicatorType
    }
  }

  return {
    interbasePackedBuffer,
    indicatorPackedBuffer,
    maxCount: scale,
    segmentCount,
    indicatorCount,
  }
}

/**
 * The zero-event result, for the paths that skip the coverage band entirely.
 *
 * Allocated fresh per call rather than shared: the worker transfers these
 * buffers, which detaches them, so a module-level singleton would throw
 * DataCloneError on the second RPC reply.
 */
export function emptyInterbaseCoverage() {
  return emptyResult()
}
