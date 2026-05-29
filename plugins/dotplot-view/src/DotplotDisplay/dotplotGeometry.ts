import { visitCigarRenderedSegments } from '@jbrowse/synteny-core'

import type { DotplotColorFn } from './dotplotColors.ts'
import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'
import type { DotplotRpcData } from './types.ts'

// Below this on-screen feature width we collapse CIGAR detail to a single
// segment — sub-pixel CIGAR ops aren't visible anyway and skipping them
// is the dominant frame-time win at zoomed-out views.
const MIN_CIGAR_PX_WIDTH = 4

type GeometryBuffers = Omit<DotplotGeometryData, 'instanceCount'>

function allocBuffers(capacity: number): GeometryBuffers {
  return {
    x1: new Float64Array(capacity),
    y1: new Float64Array(capacity),
    x2: new Float64Array(capacity),
    y2: new Float64Array(capacity),
    padHs: new Float32Array(capacity),
    padVs: new Float32Array(capacity),
    colors: new Uint32Array(capacity),
  }
}

function writeSegment(
  b: GeometryBuffers,
  n: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  padH: number,
  padV: number,
  color: number,
) {
  b.x1[n] = x1
  b.y1[n] = y1
  b.x2[n] = x2
  b.y2[n] = y2
  b.padHs[n] = padH
  b.padVs[n] = padV
  b.colors[n] = color
}

function trimToCount(b: GeometryBuffers, n: number): DotplotGeometryData {
  return {
    x1: b.x1.subarray(0, n),
    y1: b.y1.subarray(0, n),
    x2: b.x2.subarray(0, n),
    y2: b.y2.subarray(0, n),
    padHs: b.padHs.subarray(0, n),
    padVs: b.padVs.subarray(0, n),
    colors: b.colors.subarray(0, n),
    instanceCount: n,
  }
}

export function buildLineSegments(
  data: DotplotRpcData,
  colorFn: DotplotColorFn,
  drawCigar: boolean,
  minAlignmentLength: number,
  bpPerPxH: number,
  bpPerPxV: number,
): DotplotGeometryData {
  const {
    p11,
    p12,
    p21,
    p22,
    padHs,
    padVs,
    starts,
    ends,
    strands,
    parsedCigars,
  } = data
  const count = p11.length
  const bpPerPxHInv = 1 / bpPerPxH
  const bpPerPxVInv = 1 / bpPerPxV

  // Upper bound: one segment per feature, plus one per CIGAR op if drawing.
  let maxSegments = count
  if (drawCigar) {
    for (let i = 0; i < count; i++) {
      maxSegments += parsedCigars[i]!.length
    }
  }

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
    const padH = padHs[i]!
    const padV = padVs[i]!
    const cigar = parsedCigars[i]!
    const featureWidthPx = Math.max(
      Math.abs(x2 - x1) * bpPerPxHInv,
      Math.abs(y2 - y1) * bpPerPxVInv,
    )
    const color = colorFn(data, i)
    const strand = strands[i]!

    if (cigar.length > 0 && drawCigar && featureWidthPx >= MIN_CIGAR_PX_WIDTH) {
      visitCigarRenderedSegments(
        cigar,
        x1,
        y1,
        bpPerPxH,
        bpPerPxV,
        strand,
        1,
        (_op, seg1Start, seg1End, seg2Start, seg2End) => {
          writeSegment(
            buf,
            n,
            seg1Start,
            seg2Start,
            seg1End,
            seg2End,
            padH,
            padV,
            color,
          )
          n++
        },
      )
    } else {
      writeSegment(buf, n, x1, y1, x2, y2, padH, padV, color)
      n++
    }
  }

  return trimToCount(buf, n)
}
