import { AssemblyManager, Feature, ViewSnap } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'

// locals
import { interstitialYPos } from '../../util'

type RectTuple = [number, number, number, number]

const [LEFT, , RIGHT] = [0, 1, 2, 3]

interface Match {
  layout: RectTuple
  feature: { start: number; end: number }
  level: number
  refName: string
}

export function drawMatchSimple({
  match,
  ctx,
  offsets,
  cb,
  viewSnaps,
  showIntraviewLinks,
  hideTiny,
  height,
  drawCurves,
}: {
  match: Match[]
  ctx: CanvasRenderingContext2D
  offsets: number[]
  cb: (ctx: CanvasRenderingContext2D) => void
  viewSnaps: ViewSnap[]
  showIntraviewLinks: boolean
  hideTiny: boolean
  height: number
  drawCurves?: boolean
}) {
  // we follow a path in the list of chunks, not from top to bottom, just
  // in series following x1,y1 -> x2,y2
  for (let i = 0; i < match.length - 1; i += 1) {
    const { layout: c1, feature: f1, level: l1, refName: ref1 } = match[i]
    const { layout: c2, feature: f2, level: l2, refName: ref2 } = match[i + 1]
    const v1 = viewSnaps[l1]
    const v2 = viewSnaps[l2]

    if (!c1 || !c2) {
      console.warn('received null layout for a overlay feature')
      return
    }

    // disable rendering connections in a single level
    if (!showIntraviewLinks && l1 === l2) {
      continue
    }
    const length1 = f1.end - f1.start
    const length2 = f2.end - f2.start

    if ((length1 < v1.bpPerPx || length2 < v2.bpPerPx) && hideTiny) {
      continue
    }

    const px11 = bpToPx({ self: v1, refName: ref1, coord: c1[LEFT] })
    const px12 = bpToPx({ self: v1, refName: ref1, coord: c1[RIGHT] })
    const px21 = bpToPx({ self: v2, refName: ref2, coord: c2[LEFT] })
    const px22 = bpToPx({ self: v2, refName: ref2, coord: c2[RIGHT] })
    if (
      px11 === undefined ||
      px12 === undefined ||
      px21 === undefined ||
      px22 === undefined
    ) {
      continue
    }

    const x11 = px11.offsetPx - offsets[l1]
    const x12 = px12.offsetPx - offsets[l1]
    const x21 = px21.offsetPx - offsets[l2]
    const x22 = px22.offsetPx - offsets[l2]

    const y1 = interstitialYPos(l1 < l2, height)
    const y2 = interstitialYPos(l2 < l1, height)
    const mid = (y2 - y1) / 2

    // drawing a line if the results are thin: drawing a line results in much
    // less pixellation than filling in a thin polygon
    if (length1 < v1.bpPerPx || length2 < v2.bpPerPx) {
      ctx.beginPath()
      ctx.moveTo(x11, y1)
      if (drawCurves) {
        ctx.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      } else {
        ctx.lineTo(x21, y2)
      }
      ctx.stroke()
    } else {
      draw(ctx, x11, x12, y1, x22, x21, y2, mid, drawCurves)
      cb(ctx)
    }
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
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y1)
  ctx.bezierCurveTo(x2, mid, x3, mid, x3, y2)
  ctx.lineTo(x4, y2)
  ctx.bezierCurveTo(x4, mid, x1, mid, x1, y1)
  ctx.closePath()
  ctx.fill()
}
