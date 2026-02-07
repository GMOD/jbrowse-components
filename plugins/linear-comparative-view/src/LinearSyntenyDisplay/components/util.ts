import { assembleLocString, toLocale } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

export interface ClickCoord {
  clientX: number
  clientY: number
  feature: { f: Feature }
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

export function drawLocationMarkers(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y1: number,
  x3: number,
  x4: number,
  y2: number,
  mid: number,
  bpPerPx1: number,
  bpPerPx2: number,
  drawCurves?: boolean,
) {
  const width1 = Math.abs(x2 - x1)
  const width2 = Math.abs(x4 - x3)
  const averageWidth = (width1 + width2) / 2

  // Only draw markers for sufficiently large matches (wider than ~30 pixels)
  if (averageWidth < 30) {
    return
  }

  // Aim for markers at consistent pixel spacing for even visual density
  // Target spacing of ~20 pixels between markers regardless of feature size
  const targetPixelSpacing = 20
  const numMarkers = Math.max(
    2,
    Math.floor(averageWidth / targetPixelSpacing) + 1,
  )

  const prevStrokeStyle = ctx.strokeStyle
  const prevLineWidth = ctx.lineWidth

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)' // Dark semi-transparent line
  ctx.lineWidth = 0.5

  // Create single path for all markers
  ctx.beginPath()
  if (drawCurves) {
    for (let step = 0; step < numMarkers; step++) {
      const t = step / numMarkers
      const topX = x1 + (x2 - x1) * t
      const bottomX = x4 + (x3 - x4) * t
      ctx.moveTo(topX, y1)
      ctx.bezierCurveTo(topX, mid, bottomX, mid, bottomX, y2)
    }
  } else {
    for (let step = 0; step < numMarkers; step++) {
      const t = step / numMarkers
      const topX = x1 + (x2 - x1) * t
      const bottomX = x4 + (x3 - x4) * t
      ctx.moveTo(topX, y1)
      ctx.lineTo(bottomX, y2)
    }
  }
  ctx.stroke()

  ctx.strokeStyle = prevStrokeStyle
  ctx.lineWidth = prevLineWidth
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
}

export function getTooltip({
  feature,
  cigarOp,
  cigarOpLen,
}: {
  feature: Feature
  cigarOpLen?: string
  cigarOp?: string
}) {
  // @ts-expect-error
  const f1 = feature.toJSON() as {
    refName: string
    start: number
    end: number
    strand?: number
    assemblyName: string
    identity?: number
    name?: string
    mate: {
      start: number
      end: number
      refName: string
      name: string
    }
  }
  const f2 = f1.mate
  const l1 = f1.end - f1.start
  const l2 = f2.end - f2.start
  const identity = f1.identity
  const n1 = f1.name
  const n2 = f2.name
  return [
    `Loc1: ${assembleLocString(f1)}`,
    `Loc2: ${assembleLocString(f2)}`,
    `Inverted: ${f1.strand === -1}`,
    `Query len: ${toLocale(l1)}`,
    `Target len: ${toLocale(l2)}`,
    identity ? `Identity: ${identity.toPrecision(2)}` : '',
    cigarOp ? `CIGAR operator: ${toLocale(+cigarOpLen!)}${cigarOp}` : '',
    n1 ? `Name 1: ${n1}` : '',
    n2 ? `Name 2: ${n2}` : '',
  ]
    .filter(f => !!f)
    .join('<br/>')
}
