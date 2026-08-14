// Reading the interbase-histogram and indicator instance buffers back on the
// main thread — the hit test's half of what `computeInterbaseCoverage` writes.
//
// The buffers are the only shipped form of these marks, so this is where a
// non-drawing reader gets at them. Every field access is the `.slang`'s own
// generated getter, which binds the field to its view; nothing here restates
// a stride or an offset.

import {
  INSTANCE_STRIDE_BYTES as INDICATOR_STRIDE_BYTES,
  getInstanceColorType as getIndicatorColorType,
  getInstancePosition as getIndicatorPosition,
} from './indicatorLayout.generated.ts'
import {
  INSTANCE_STRIDE_BYTES as SEGMENT_STRIDE_BYTES,
  getInstanceColorType as getSegmentColorType,
  getInstancePosition as getSegmentPosition,
  getInstanceSegHeight as getSegmentHeight,
  getInstanceYOffset as getSegmentYOffset,
} from './interbaseHistogramLayout.generated.ts'

export interface InterbaseSegmentReader {
  count: number
  position: (i: number) => number
  /** Bottom of segment i as a fraction of the full-scale bar (yOffset + height). */
  stackEnd: (i: number) => number
  /** 1=insertion 2=softclip 3=hardclip. */
  colorType: (i: number) => number
}

export function readInterbaseSegments(
  buffer: ArrayBuffer,
): InterbaseSegmentReader {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  return {
    count: buffer.byteLength / SEGMENT_STRIDE_BYTES,
    position: i => getSegmentPosition(u32, i),
    stackEnd: i => getSegmentYOffset(f32, i) + getSegmentHeight(f32, i),
    colorType: i => getSegmentColorType(f32, i),
  }
}

export interface IndicatorReader {
  count: number
  position: (i: number) => number
  /** Dominant type: 1=insertion 2=softclip 3=hardclip. */
  colorType: (i: number) => number
}

export function readIndicators(buffer: ArrayBuffer): IndicatorReader {
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  return {
    count: buffer.byteLength / INDICATOR_STRIDE_BYTES,
    position: i => getIndicatorPosition(u32, i),
    colorType: i => getIndicatorColorType(f32, i),
  }
}

interface PositionedRecords {
  count: number
  position: (i: number) => number
}

/**
 * FIRST index of the run of records at the position nearest `genomicPos`, or -1
 * when that position is further away than `toleranceBp`. An interbase stack is
 * up to three records at one position, so "first of the run" is the useful
 * answer — the caller walks forward from it.
 *
 * A binary search, which is what `computeInterbaseCoverage` emitting in
 * ascending position order buys. This ran as two linear scans of every segment
 * in the region, per track, on every mousemove, to resolve a hover that lands
 * on one position.
 *
 * Same lower-bound idea as `positionIndex.ts`'s `lowerBound`, and deliberately
 * not shared with it: that one probes a plain sorted `Uint32Array` built for
 * the per-event arrays, which arrive in read order and need an index built
 * beside them. These positions are INTERLEAVED in the instance buffer at the
 * shader's stride and are already sorted, so there is nothing to build and no
 * flat array to probe.
 */
export function nearestRecordIndex(
  reader: PositionedRecords,
  genomicPos: number,
  toleranceBp: number,
) {
  const { count, position } = reader
  // Lower bound: the first index whose position is >= genomicPos. The nearest
  // record is that one or the one before it, and nothing else can be closer.
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (position(mid) < genomicPos) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  let best = -1
  let bestDist = toleranceBp
  if (lo > 0) {
    const dist = genomicPos - position(lo - 1)
    if (dist < bestDist) {
      bestDist = dist
      best = runStart(reader, lo - 1)
    }
  }
  // Strict, so an exact tie stays with the run on the left. `lo` needs no
  // runStart: position(lo - 1) < genomicPos <= position(lo), so it already
  // begins its own run.
  if (lo < count && position(lo) - genomicPos < bestDist) {
    best = lo
  }
  return best
}

/** First index of the run of records sharing `i`'s position. */
function runStart(reader: PositionedRecords, i: number) {
  const pos = reader.position(i)
  let start = i
  while (start > 0 && reader.position(start - 1) === pos) {
    start--
  }
  return start
}
