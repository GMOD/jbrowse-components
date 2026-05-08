import { visitCigarRenderedSegments } from '@jbrowse/synteny-core'

import { splitHiLo } from './hiLoUtils.ts'

import type { DotplotColorFn } from './dotplotWebGLColors.ts'
import type { DotplotRpcData } from './types.ts'

export interface LineSegmentArrays {
  x1Hi: Float32Array
  x1Lo: Float32Array
  y1Hi: Float32Array
  y1Lo: Float32Array
  x2Hi: Float32Array
  x2Lo: Float32Array
  y2Hi: Float32Array
  y2Lo: Float32Array
  padHs: Float32Array
  padVs: Float32Array
  colors: Uint32Array
  count: number
}

const MIN_CIGAR_PX_WIDTH = 4

interface Cursor {
  n: number
  x1Hi: Float32Array
  x1Lo: Float32Array
  y1Hi: Float32Array
  y1Lo: Float32Array
  x2Hi: Float32Array
  x2Lo: Float32Array
  y2Hi: Float32Array
  y2Lo: Float32Array
  padHs: Float32Array
  padVs: Float32Array
  colors: Uint32Array
}


export function buildLineSegments(
  data: DotplotRpcData,
  colorFn: DotplotColorFn,
  drawCigar: boolean,
  minAlignmentLength: number,
  bpPerPxH: number,
  bpPerPxV: number,
): LineSegmentArrays {
  const {
    p11Hi,
    p11Lo,
    p12Hi,
    p12Lo,
    p21Hi,
    p21Lo,
    p22Hi,
    p22Lo,
    padHs,
    padVs,
    starts,
    ends,
    strands,
    parsedCigars,
  } = data
  const count = p11Hi.length
  const bpPerPxHInv = 1 / bpPerPxH
  const bpPerPxVInv = 1 / bpPerPxV

  let maxSegments = 0
  if (drawCigar) {
    for (let i = 0; i < count; i++) {
      maxSegments += 1 + parsedCigars[i]!.length
    }
  } else {
    maxSegments = count
  }

  const out: Cursor = {
    n: 0,
    x1Hi: new Float32Array(maxSegments),
    x1Lo: new Float32Array(maxSegments),
    y1Hi: new Float32Array(maxSegments),
    y1Lo: new Float32Array(maxSegments),
    x2Hi: new Float32Array(maxSegments),
    x2Lo: new Float32Array(maxSegments),
    y2Hi: new Float32Array(maxSegments),
    y2Lo: new Float32Array(maxSegments),
    padHs: new Float32Array(maxSegments),
    padVs: new Float32Array(maxSegments),
    colors: new Uint32Array(maxSegments),
  }

  for (let i = 0; i < count; i++) {
    if (
      minAlignmentLength > 0 &&
      Math.abs(ends[i]! - starts[i]!) < minAlignmentLength
    ) {
      continue
    }
    const p11CumBp = p11Hi[i]! + p11Lo[i]!
    const p12CumBp = p12Hi[i]! + p12Lo[i]!
    const p21CumBp = p21Hi[i]! + p21Lo[i]!
    const p22CumBp = p22Hi[i]! + p22Lo[i]!
    const padH = padHs[i]!
    const padV = padVs[i]!
    const cigar = parsedCigars[i]!
    const featureWidthH = Math.abs(p12CumBp - p11CumBp) * bpPerPxHInv
    const featureWidthV = Math.abs(p22CumBp - p21CumBp) * bpPerPxVInv
    const featureWidth = Math.max(featureWidthH, featureWidthV)
    const color = colorFn(data, i)
    const strand = strands[i]!

    if (cigar.length > 0 && drawCigar && featureWidth >= MIN_CIGAR_PX_WIDTH) {
      visitCigarRenderedSegments(
        cigar,
        p11CumBp,
        p21CumBp,
        bpPerPxH,
        bpPerPxV,
        strand,
        1,
        (_op, segBp1Start, segBp1End, segBp2Start, segBp2End) => {
          const n = out.n
          splitHiLo(out.x1Hi, out.x1Lo, n, segBp1Start)
          splitHiLo(out.y1Hi, out.y1Lo, n, segBp2Start)
          splitHiLo(out.x2Hi, out.x2Lo, n, segBp1End)
          splitHiLo(out.y2Hi, out.y2Lo, n, segBp2End)
          out.padHs[n] = padH
          out.padVs[n] = padV
          out.colors[n] = color
          out.n = n + 1
        },
      )
    } else {
      const n = out.n
      splitHiLo(out.x1Hi, out.x1Lo, n, p11CumBp)
      splitHiLo(out.y1Hi, out.y1Lo, n, p21CumBp)
      splitHiLo(out.x2Hi, out.x2Lo, n, p12CumBp)
      splitHiLo(out.y2Hi, out.y2Lo, n, p22CumBp)
      out.padHs[n] = padH
      out.padVs[n] = padV
      out.colors[n] = color
      out.n = n + 1
    }
  }

  return {
    x1Hi: out.x1Hi.subarray(0, out.n),
    x1Lo: out.x1Lo.subarray(0, out.n),
    y1Hi: out.y1Hi.subarray(0, out.n),
    y1Lo: out.y1Lo.subarray(0, out.n),
    x2Hi: out.x2Hi.subarray(0, out.n),
    x2Lo: out.x2Lo.subarray(0, out.n),
    y2Hi: out.y2Hi.subarray(0, out.n),
    y2Lo: out.y2Lo.subarray(0, out.n),
    padHs: out.padHs.subarray(0, out.n),
    padVs: out.padVs.subarray(0, out.n),
    colors: out.colors.subarray(0, out.n),
    count: out.n,
  }
}
