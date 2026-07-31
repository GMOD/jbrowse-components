import { visitCigarRenderedSegments } from '@jbrowse/synteny-core'

import { MIN_CIGAR_PX_WIDTH } from './dotplotCigarDetail.ts'

import type { DotplotInstanceData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'

type GeometryBuffers = Omit<
  DotplotInstanceData,
  'instanceCount' | 'baseH' | 'baseV'
>

function allocBuffers(capacity: number): GeometryBuffers {
  return {
    x1: new Float64Array(capacity),
    y1: new Float64Array(capacity),
    x2: new Float64Array(capacity),
    y2: new Float64Array(capacity),
    instanceFeatureIdx: new Uint32Array(capacity),
  }
}

function writeSegment(
  b: GeometryBuffers,
  n: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  featureIdx: number,
) {
  b.x1[n] = x1
  b.y1[n] = y1
  b.x2[n] = x2
  b.y2[n] = y2
  b.instanceFeatureIdx[n] = featureIdx
}

function trimToCount(
  b: GeometryBuffers,
  n: number,
  baseH: number,
  baseV: number,
): DotplotInstanceData {
  return {
    x1: b.x1.subarray(0, n),
    y1: b.y1.subarray(0, n),
    x2: b.x2.subarray(0, n),
    y2: b.y2.subarray(0, n),
    instanceFeatureIdx: b.instanceFeatureIdx.subarray(0, n),
    instanceCount: n,
    baseH,
    baseV,
  }
}

export function buildLineSegments(
  data: DotplotRpcData,
  drawCigar: boolean,
  minAlignmentLength: number,
  bpPerPxH: number,
  bpPerPxV: number,
  baseH: number,
  baseV: number,
): DotplotInstanceData {
  const { p11, p12, p21, p22, starts, ends, cigarData, cigarOffsets } = data
  const count = p11.length
  const bpPerPxHInv = 1 / bpPerPxH
  const bpPerPxVInv = 1 / bpPerPxV

  // Upper bound: one segment per feature, plus one per CIGAR op if drawing.
  // visitCigarRenderedSegments emits at most one segment per packed op.
  const maxSegments = count + (drawCigar ? cigarData.length : 0)

  const buf = allocBuffers(maxSegments)
  let n = 0

  for (let i = 0; i < count; i++) {
    if (
      minAlignmentLength > 0 &&
      Math.abs(ends[i]! - starts[i]!) < minAlignmentLength
    ) {
      continue
    }
    const x1 = p11[i]!
    const x2 = p12[i]!
    const y1 = p21[i]!
    const y2 = p22[i]!
    const cigarStart = cigarOffsets[i]!
    const cigarEnd = cigarOffsets[i + 1]!
    const featureWidthPx = Math.max(
      Math.abs(x2 - x1) * bpPerPxHInv,
      Math.abs(y2 - y1) * bpPerPxVInv,
    )
    // Strand is already baked into the endpoints upstream (the worker swaps the
    // H-axis start/end for reverse-strand features), so the walk direction is
    // fully determined by endpoint order — no separate strand factor needed. This
    // also tracks reversed regions (e.g. auto-diagonalize flips a query region,
    // giving y1 > y2) that a hardcoded direction would walk the wrong way.
    const rev1 = x1 < x2 ? 1 : -1
    const rev2 = y1 < y2 ? 1 : -1

    if (
      cigarEnd > cigarStart &&
      drawCigar &&
      featureWidthPx >= MIN_CIGAR_PX_WIDTH
    ) {
      visitCigarRenderedSegments(
        // a view, not a copy — visitCigarRenderedSegments takes ArrayLike
        cigarData.subarray(cigarStart, cigarEnd),
        x1,
        y1,
        bpPerPxH,
        bpPerPxV,
        rev1,
        rev2,
        (_op, seg1Start, seg1End, seg2Start, seg2End) => {
          writeSegment(buf, n, seg1Start, seg2Start, seg1End, seg2End, i)
          n++
        },
      )
    } else {
      writeSegment(buf, n, x1, y1, x2, y2, i)
      n++
    }
  }

  return trimToCount(buf, n, baseH, baseV)
}
