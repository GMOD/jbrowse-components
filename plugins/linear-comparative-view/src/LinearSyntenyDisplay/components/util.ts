import { doesIntersect2, Feature } from '@jbrowse/core/util'

interface Pos {
  offsetPx: number
}

interface FeatPos {
  p11: Pos
  p12: Pos
  p21: Pos
  p22: Pos
  f: Feature
  cigar: string[]
}

export function drawMatchSimple({
  feature,
  ctx,
  offsets,
  cb,
  height,
  drawCurves,
  oobLimit,
  viewWidth,
  hideTiny,
}: {
  feature: FeatPos
  ctx: CanvasRenderingContext2D
  offsets: number[]
  oobLimit: number
  viewWidth: number
  cb: (ctx: CanvasRenderingContext2D) => void
  height: number
  drawCurves?: boolean
  hideTiny?: boolean
}) {
  const { p11, p12, p21, p22 } = feature

  const x11 = p11.offsetPx - offsets[0]
  const x12 = p12.offsetPx - offsets[0]
  const x21 = p21.offsetPx - offsets[1]
  const x22 = p22.offsetPx - offsets[1]

  const l1 = Math.abs(x12 - x11)
  const l2 = Math.abs(x22 - x21)
  const y1 = 0
  const y2 = height
  const mid = (y2 - y1) / 2
  const minX = Math.min(x21, x22)
  const maxX = Math.max(x21, x22)

  if (!doesIntersect2(minX, maxX, -oobLimit, viewWidth + oobLimit)) {
    return
  }

  // drawing a line if the results are thin: drawing a line results in much
  // less pixellation than filling in a thin polygon
  if (l1 <= 1 && l2 <= 1) {
    // hideTiny can be used to avoid drawing mouseover for thin lines in this
    // case
    if (!hideTiny) {
      ctx.beginPath()
      ctx.moveTo(x11, y1)
      if (drawCurves) {
        ctx.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      } else {
        ctx.lineTo(x21, y2)
      }
      ctx.stroke()
    }
  } else {
    draw(ctx, x11, x12, y1, x22, x21, y2, mid, drawCurves)
    cb(ctx)
  }
}

export function draw(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
  mid: number,
  drawCurves?: boolean,
) {
  if (drawCurves) {
    drawBezierBox(ctx, x1, x2, y1, x3, x4, y2, mid)
  } else {
    drawBox(ctx, x1, x2, y1, x3, x4, y2)
  }
}

export function drawBox(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y1)
  ctx.lineTo(x3, y2)
  ctx.lineTo(x4, y2)
  ctx.closePath()
  ctx.fill()
}

export function drawBezierBox(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
  mid: number,
) {
  const len1 = Math.abs(x1 - x2)
  const len2 = Math.abs(x1 - x2)

  // heuristic to not draw hourglass inversions with bezier curves when they
  // are thin and far apart because it results in areas that are not drawn well
  // demo https://codesandbox.io/s/fast-glitter-q3b1or?file=/src/index.js
  if (len1 < 5 && len2 < 5 && x2 < x1 && Math.abs(x1 - x3) > 100) {
    const tmp = x1
    x1 = x2
    x2 = tmp
  }
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y1)
  ctx.bezierCurveTo(x2, mid, x3, mid, x3, y2)
  ctx.lineTo(x4, y2)
  ctx.bezierCurveTo(x4, mid, x1, mid, x1, y1)
  ctx.closePath()
  ctx.fill()
}
