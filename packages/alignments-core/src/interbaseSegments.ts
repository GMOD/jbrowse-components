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
  /** Top of segment i as a fraction of the full-scale bar (its yOffset). */
  stackStart: (i: number) => number
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
    stackStart: i => getSegmentYOffset(f32, i),
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
 * The index range `[start, end)` of the records whose position lies within
 * `toleranceBp` of `genomicPos` — the candidate set a band shape's `hitNearest`
 * measures. A binary search, which is what `computeInterbaseCoverage` emitting
 * in ascending position order buys: this ran as a linear scan of every segment
 * in the region, per track, on every mousemove.
 *
 * Same lower-bound idea as `positionIndex.ts`'s `lowerBound`, and deliberately
 * not shared with it: that one probes a plain sorted `Uint32Array`, and these
 * positions are INTERLEAVED in the instance buffer at the shader's stride.
 */
export function recordsWithin(
  reader: PositionedRecords,
  genomicPos: number,
  toleranceBp: number,
): [number, number] {
  return [
    lowerBoundRecord(reader, genomicPos - toleranceBp),
    lowerBoundRecord(reader, genomicPos + toleranceBp),
  ]
}

function lowerBoundRecord({ count, position }: PositionedRecords, bp: number) {
  let lo = 0
  let hi = count
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (position(mid) < bp) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}
