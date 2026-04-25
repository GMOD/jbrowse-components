import type { DotplotColorFn } from './dotplotWebGLColors.ts'
import type { DotplotRpcData } from './types.ts'

export interface LineSegmentArrays {
  x1s: Float32Array
  y1s: Float32Array
  x2s: Float32Array
  y2s: Float32Array
  colors: Uint32Array
  count: number
}

const MIN_CIGAR_PX_WIDTH = 4

interface Cursor {
  n: number
  x1s: Float32Array
  y1s: Float32Array
  x2s: Float32Array
  y2s: Float32Array
  colors: Uint32Array
}

function decomposeCigar(
  p11: number,
  p12: number,
  p21: number,
  p22: number,
  cigar: string[],
  color: number,
  hBpPerPx: number,
  vBpPerPx: number,
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

  const pxPerBpH = totalBpH > 0 ? Math.abs(hRange) / totalBpH : 1 / hBpPerPx
  const pxPerBpV = totalBpV > 0 ? Math.abs(vRange) / totalBpV : 1 / vBpPerPx
  const hDir = hRange >= 0 ? 1 : -1
  const vDir = vRange >= 0 ? 1 : -1

  let cx = p11
  let cy = p21
  let segStartX = cx
  let segStartY = cy

  for (let j = 0; j < cigar.length; j += 2) {
    const len = +cigar[j]!
    const op = cigar[j + 1]!

    if (op === 'M' || op === '=' || op === 'X') {
      cx += len * pxPerBpH * hDir
      cy += len * pxPerBpV * vDir
    } else if (op === 'D' || op === 'N') {
      cx += len * pxPerBpH * hDir
    } else if (op === 'I') {
      cy += len * pxPerBpV * vDir
    }

    if (Math.abs(cx - segStartX) > 0.5 || Math.abs(cy - segStartY) > 0.5) {
      const n = out.n
      out.x1s[n] = segStartX
      out.y1s[n] = segStartY
      out.x2s[n] = cx
      out.y2s[n] = cy
      out.colors[n] = color
      out.n = n + 1
      segStartX = cx
      segStartY = cy
    }
  }
}

function ensureMinExtent(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lineLen = Math.sqrt(dx * dx + dy * dy)
  if (lineLen >= 1) {
    return { x1, y1, x2, y2 }
  }
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  if (lineLen > 0.001) {
    const scale = 0.5 / lineLen
    return {
      x1: mx - dx * scale,
      y1: my - dy * scale,
      x2: mx + dx * scale,
      y2: my + dy * scale,
    }
  }
  return { x1: mx - 0.5, y1: my, x2: mx + 0.5, y2: my }
}

export function buildLineSegments(
  data: DotplotRpcData,
  colorFn: DotplotColorFn,
  drawCigar: boolean,
  minAlignmentLength: number,
): LineSegmentArrays {
  const {
    p11s,
    p12s,
    p21s,
    p22s,
    starts,
    ends,
    parsedCigars,
    bpPerPxH,
    bpPerPxV,
  } = data
  const count = p11s.length

  // Upper bound: one segment per non-filtered feature, plus one extra
  // per cigar op when drawing CIGARs. Over-allocates a bit, final
  // arrays are subarray'd to the true count.
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
    x1s: new Float32Array(maxSegments),
    y1s: new Float32Array(maxSegments),
    x2s: new Float32Array(maxSegments),
    y2s: new Float32Array(maxSegments),
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
    const cigar = parsedCigars[i]!
    const featureWidth = Math.max(Math.abs(p12 - p11), Math.abs(p22 - p21))
    const color = colorFn(data, i)

    if (cigar.length > 0 && drawCigar && featureWidth >= MIN_CIGAR_PX_WIDTH) {
      decomposeCigar(p11, p12, p21, p22, cigar, color, bpPerPxH, bpPerPxV, out)
    } else {
      const { x1, y1, x2, y2 } = ensureMinExtent(p11, p21, p12, p22)
      const n = out.n
      out.x1s[n] = x1
      out.y1s[n] = y1
      out.x2s[n] = x2
      out.y2s[n] = y2
      out.colors[n] = color
      out.n = n + 1
    }
  }

  return {
    x1s: out.x1s.subarray(0, out.n),
    y1s: out.y1s.subarray(0, out.n),
    x2s: out.x2s.subarray(0, out.n),
    y2s: out.y2s.subarray(0, out.n),
    colors: out.colors.subarray(0, out.n),
    count: out.n,
  }
}
