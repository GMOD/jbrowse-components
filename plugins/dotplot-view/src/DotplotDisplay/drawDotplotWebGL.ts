import type { DotplotColorFn } from './dotplotWebGLColors.ts'
import type { DotplotRpcData } from './types.ts'

export interface LineSegmentArrays {
  x1s: Uint32Array
  y1s: Uint32Array
  x2s: Uint32Array
  y2s: Uint32Array
  xRegionIdx: Uint8Array
  yRegionIdx: Uint8Array
  colors: Uint32Array
  count: number
}

const MIN_CIGAR_PX_WIDTH = 4

interface Cursor {
  n: number
  x1s: Uint32Array
  y1s: Uint32Array
  x2s: Uint32Array
  y2s: Uint32Array
  xRegionIdx: Uint8Array
  yRegionIdx: Uint8Array
  colors: Uint32Array
}

function decomposeCigar(
  p11: number,
  p12: number,
  p21: number,
  p22: number,
  xRegIdx: number,
  yRegIdx: number,
  cigar: string[],
  color: number,
  out: Cursor,
) {
  const hRange = p12 - p11
  const vRange = p22 - p21

  let totalBpH = 0
  let totalBpV = 0
  for (let j = 0; j < cigar.length; j += 2) {
    const len = +cigar[j]!
    const op = cigar[j + 1]
    if (op === 'M' || op === '=' || op === 'X') {
      totalBpH += len
      totalBpV += len
    } else if (op === 'D' || op === 'N') {
      totalBpH += len
    } else if (op === 'I') {
      totalBpV += len
    }
  }

  // Stretch handles malformed CIGARs whose op lengths don't sum to the
  // alignment's bp span. For well-formed CIGARs both stretch factors are 1.
  const stretchH = totalBpH > 0 ? Math.abs(hRange) / totalBpH : 1
  const stretchV = totalBpV > 0 ? Math.abs(vRange) / totalBpV : 1
  const hDir = hRange >= 0 ? 1 : -1
  const vDir = vRange >= 0 ? 1 : -1

  let cx = p11
  let cy = p21

  for (let j = 0; j < cigar.length; j += 2) {
    const len = +cigar[j]!
    const op = cigar[j + 1]
    let nx = cx
    let ny = cy

    if (op === 'M' || op === '=' || op === 'X') {
      nx = cx + len * stretchH * hDir
      ny = cy + len * stretchV * vDir
    } else if (op === 'D' || op === 'N') {
      nx = cx + len * stretchH * hDir
    } else if (op === 'I') {
      ny = cy + len * stretchV * vDir
    }

    const n = out.n
    out.x1s[n] = Math.max(0, Math.round(cx))
    out.y1s[n] = Math.max(0, Math.round(cy))
    out.x2s[n] = Math.max(0, Math.round(nx))
    out.y2s[n] = Math.max(0, Math.round(ny))
    out.xRegionIdx[n] = xRegIdx
    out.yRegionIdx[n] = yRegIdx
    out.colors[n] = color
    out.n = n + 1

    cx = nx
    cy = ny
  }
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
    p11s,
    p12s,
    p21s,
    p22s,
    xRegionIdx: xRegIdxIn,
    yRegionIdx: yRegIdxIn,
    starts,
    ends,
    parsedCigars,
  } = data
  const count = p11s.length

  // Upper bound: one segment per non-filtered feature, plus one extra
  // per cigar op when drawing CIGARs.
  let maxSegments = 0
  if (drawCigar) {
    for (let i = 0; i < count; i++) {
      maxSegments += 1 + parsedCigars[i]!.length / 2
    }
  } else {
    maxSegments = count
  }

  const out: Cursor = {
    n: 0,
    x1s: new Uint32Array(maxSegments),
    y1s: new Uint32Array(maxSegments),
    x2s: new Uint32Array(maxSegments),
    y2s: new Uint32Array(maxSegments),
    xRegionIdx: new Uint8Array(maxSegments),
    yRegionIdx: new Uint8Array(maxSegments),
    colors: new Uint32Array(maxSegments),
  }

  for (let i = 0; i < count; i++) {
    if (
      minAlignmentLength > 0 &&
      Math.abs(ends[i]! - starts[i]!) < minAlignmentLength
    ) {
      continue
    }
    const p11 = p11s[i]!
    const p12 = p12s[i]!
    const p21 = p21s[i]!
    const p22 = p22s[i]!
    const xRegIdx = xRegIdxIn[i]!
    const yRegIdx = yRegIdxIn[i]!
    const cigar = parsedCigars[i]!
    // featureWidth is the dominant pixel extent at the build-time bpPerPx;
    // LOD-approximate (build bpPerPx may differ from current view bpPerPx).
    const featureWidthPx = Math.max(
      Math.abs(p12 - p11) / bpPerPxH,
      Math.abs(p22 - p21) / bpPerPxV,
    )
    const color = colorFn(data, i)

    if (cigar.length > 0 && drawCigar && featureWidthPx >= MIN_CIGAR_PX_WIDTH) {
      decomposeCigar(p11, p12, p21, p22, xRegIdx, yRegIdx, cigar, color, out)
    } else {
      const n = out.n
      out.x1s[n] = p11
      out.y1s[n] = p21
      out.x2s[n] = p12
      out.y2s[n] = p22
      out.xRegionIdx[n] = xRegIdx
      out.yRegionIdx[n] = yRegIdx
      out.colors[n] = color
      out.n = n + 1
    }
  }

  return {
    x1s: out.x1s.subarray(0, out.n),
    y1s: out.y1s.subarray(0, out.n),
    x2s: out.x2s.subarray(0, out.n),
    y2s: out.y2s.subarray(0, out.n),
    xRegionIdx: out.xRegionIdx.subarray(0, out.n),
    yRegionIdx: out.yRegionIdx.subarray(0, out.n),
    colors: out.colors.subarray(0, out.n),
    count: out.n,
  }
}
