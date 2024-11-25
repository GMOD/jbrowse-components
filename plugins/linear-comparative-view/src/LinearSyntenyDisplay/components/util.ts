import type React from 'react'
import {
  assembleLocString,
  doesIntersect2,
  getSession,
  isSessionModelWithWidgets,
  getContainingTrack,
  getContainingView,
} from '@jbrowse/core/util'

// locals
import { getId, MAX_COLOR_RANGE } from '../drawSynteny'
import type { LinearSyntenyDisplayModel } from '../model'
import type { Feature } from '@jbrowse/core/util'

interface Pos {
  offsetPx: number
}

export interface ClickCoord {
  clientX: number
  clientY: number
  feature: { f: Feature }
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
  level,
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
  level: number
  oobLimit: number
  viewWidth: number
  cb: (ctx: CanvasRenderingContext2D) => void
  height: number
  drawCurves?: boolean
  hideTiny?: boolean
}) {
  const { p11, p12, p21, p22 } = feature

  const x11 = p11.offsetPx - offsets[level]!
  const x12 = p12.offsetPx - offsets[level]!
  const x21 = p21.offsetPx - offsets[level + 1]!
  const x22 = p22.offsetPx - offsets[level + 1]!

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

export function onSynClick(
  event: React.MouseEvent,
  model: LinearSyntenyDisplayModel,
) {
  const view = getContainingView(model)
  const track = getContainingTrack(model)
  const {
    featPositions,
    numFeats,
    clickMapCanvas: ref1,
    cigarClickMapCanvas: ref2,
    level,
  } = model
  if (!ref1 || !ref2) {
    return
  }
  const rect = ref1.getBoundingClientRect()
  const ctx1 = ref1.getContext('2d')
  const ctx2 = ref2.getContext('2d')
  if (!ctx1 || !ctx2) {
    return
  }
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
  const unitMultiplier = Math.floor(MAX_COLOR_RANGE / numFeats)
  const id = getId(r1!, g1!, b1!, unitMultiplier)
  const feat = featPositions[id]
  if (feat) {
    const { f } = feat
    model.setClickId(f.id())
    const session = getSession(model)
    if (isSessionModelWithWidgets(session)) {
      session.showWidget(
        session.addWidget('SyntenyFeatureWidget', 'syntenyFeature', {
          view,
          track,
          featureData: f.toJSON(),
          level,
        }),
      )
    }
  }
  return feat
}

export function onSynContextClick(
  event: React.MouseEvent,
  model: LinearSyntenyDisplayModel,
  setAnchorEl: (arg: ClickCoord) => void,
) {
  event.preventDefault()
  const ref1 = model.clickMapCanvas
  const ref2 = model.cigarClickMapCanvas
  if (!ref1 || !ref2) {
    return
  }
  const rect = ref1.getBoundingClientRect()
  const ctx1 = ref1.getContext('2d')
  const ctx2 = ref2.getContext('2d')
  if (!ctx1 || !ctx2) {
    return
  }
  const { clientX, clientY } = event
  const x = clientX - rect.left
  const y = clientY - rect.top
  const [r1, g1, b1] = ctx1.getImageData(x, y, 1, 1).data
  const unitMultiplier = Math.floor(MAX_COLOR_RANGE / model.numFeats)
  const id = getId(r1!, g1!, b1!, unitMultiplier)
  const f = model.featPositions[id]
  if (f) {
    model.setClickId(f.f.id())
    setAnchorEl({ clientX, clientY, feature: f })
  }
}

export function getTooltip({
  feature,
  cigarOp,
  cigarOpLen,
}: {
  feature: Feature
  cigarOp?: string
  cigarOpLen?: string
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
    `Query len: ${l1.toLocaleString('en-US')}`,
    `Target len: ${l2.toLocaleString('en-US')}`,
    identity ? `Identity: ${identity.toPrecision(2)}` : '',
    cigarOp ? `CIGAR operator: ${cigarOp}${cigarOpLen}` : '',
    n1 ? `Name 1: ${n1}` : '',
    n2 ? `Name 1: ${n2}` : '',
  ]
    .filter(f => !!f)
    .join('<br/>')
}
