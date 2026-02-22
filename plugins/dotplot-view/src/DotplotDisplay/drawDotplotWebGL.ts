import type { DotplotFeatPos } from './types.ts'

export interface LineSegments {
  x1s: number[]
  y1s: number[]
  x2s: number[]
  y2s: number[]
  colors: number[]
}

const MIN_CIGAR_PX_WIDTH = 4

type ColorFn = (
  f: DotplotFeatPos,
  index: number,
) => [number, number, number, number]

function decomposeCigar(
  feat: DotplotFeatPos,
  index: number,
  colorFn: ColorFn,
  hBpPerPx: number,
  vBpPerPx: number,
  out: LineSegments,
) {
  const { p11, p12, p21, p22, cigar } = feat
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
      const [cr, cg, cb, ca] = colorFn(feat, index)
      out.x1s.push(segStartX)
      out.y1s.push(segStartY)
      out.x2s.push(cx)
      out.y2s.push(cy)
      out.colors.push(cr, cg, cb, ca)
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
  featPositions: DotplotFeatPos[],
  colorFn: ColorFn,
  drawCigar: boolean,
  hBpPerPx: number,
  vBpPerPx: number,
) {
  const out: LineSegments = {
    x1s: [],
    y1s: [],
    x2s: [],
    y2s: [],
    colors: [],
  }

  for (const [i, feat] of featPositions.entries()) {
    const { p11, p12, p21, p22, cigar } = feat
    const featureWidth = Math.max(Math.abs(p12 - p11), Math.abs(p22 - p21))

    if (cigar.length >= 2 && drawCigar && featureWidth >= MIN_CIGAR_PX_WIDTH) {
      decomposeCigar(feat, i, colorFn, hBpPerPx, vBpPerPx, out)
    } else {
      const [cr, cg, cb, ca] = colorFn(feat, i)
      const { x1, y1, x2, y2 } = ensureMinExtent(p11, p21, p12, p22)
      out.x1s.push(x1)
      out.y1s.push(y1)
      out.x2s.push(x2)
      out.y2s.push(y2)
      out.colors.push(cr, cg, cb, ca)
    }
  }

  return out
}
