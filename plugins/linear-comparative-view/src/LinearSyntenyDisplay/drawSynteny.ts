import { doesIntersect2, getContainingView } from '@jbrowse/core/util'
// locals
import { draw, drawMatchSimple } from './components/util'
import type { LinearSyntenyDisplayModel } from './model'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

export const MAX_COLOR_RANGE = 255 * 255 * 255 // max color range

function makeColor(idx: number) {
  const r = Math.floor(idx / (255 * 255)) % 255
  const g = Math.floor(idx / 255) % 255
  const b = idx % 255
  return `rgb(${r},${g},${b})`
}

const colorMap = {
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

const lineLimit = 3

const oobLimit = 1600

export function getId(r: number, g: number, b: number, unitMultiplier: number) {
  return Math.floor((r * 255 * 255 + g * 255 + b - 1) / unitMultiplier)
}

export function drawRef(
  model: LinearSyntenyDisplayModel,
  ctx1: CanvasRenderingContext2D,
  ctx3?: CanvasRenderingContext2D,
) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const drawCurves = view.drawCurves
  const drawCIGAR = view.drawCIGAR
  const { level, height, featPositions } = model
  const width = view.width
  const bpPerPxs = view.views.map(v => v.bpPerPx)

  if (ctx3) {
    ctx3.imageSmoothingEnabled = false
  }

  ctx1.beginPath()
  const offsets = view.views.map(v => v.offsetPx)
  const unitMultiplier = Math.floor(MAX_COLOR_RANGE / featPositions.length)

  // this loop is optimized to draw many thin lines with a single ctx.stroke
  // call, a separate loop below draws larger boxes
  ctx1.fillStyle = colorMap.M
  ctx1.strokeStyle = colorMap.M
  for (const { p11, p12, p21, p22 } of featPositions) {
    const x11 = p11.offsetPx - offsets[level]!
    const x12 = p12.offsetPx - offsets[level]!
    const x21 = p21.offsetPx - offsets[level + 1]!
    const x22 = p22.offsetPx - offsets[level + 1]!
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)
    const y1 = 0
    const y2 = height
    const mid = (y2 - y1) / 2

    // drawing a line if the results are thin results in much less pixellation
    // than filling in a thin polygon
    if (
      l1 <= lineLimit &&
      l2 <= lineLimit &&
      x21 < width + oobLimit &&
      x21 > -oobLimit
    ) {
      ctx1.moveTo(x11, y1)
      if (drawCurves) {
        ctx1.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      } else {
        ctx1.lineTo(x21, y2)
      }
    }
  }
  ctx1.stroke()

  // this loop only draws small lines as a polyline, the polyline calls
  // ctx.stroke once is much more efficient than calling stroke() many times
  ctx1.fillStyle = colorMap.M
  ctx1.strokeStyle = colorMap.M
  for (const { p11, p12, p21, p22, f, cigar } of featPositions) {
    const x11 = p11.offsetPx - offsets[level]!
    const x12 = p12.offsetPx - offsets[level]!
    const x21 = p21.offsetPx - offsets[level + 1]!
    const x22 = p22.offsetPx - offsets[level + 1]!
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)
    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)
    const y1 = 0
    const y2 = height
    const mid = (y2 - y1) / 2

    if (
      !(l1 <= lineLimit && l2 <= lineLimit) &&
      doesIntersect2(minX, maxX, -oobLimit, view.width + oobLimit)
    ) {
      const s1 = f.get('strand')
      const k1 = s1 === -1 ? x12 : x11
      const k2 = s1 === -1 ? x11 : x12

      // rev1/rev2 flip the direction of the CIGAR drawing in horizontally flipped
      // modes. somewhat heuristically determined, but tested for
      const rev1 = k1 < k2 ? 1 : -1
      const rev2 = (x21 < x22 ? 1 : -1) * s1

      // cx1/cx2 are the current x positions on top and bottom rows
      let cx1 = k1
      let cx2 = s1 === -1 ? x22 : x21
      if (cigar.length && drawCIGAR) {
        // continuingFlag skips drawing commands on very small CIGAR features
        let continuingFlag = false

        // px1/px2 are the previous x positions on the top and bottom rows
        let px1 = 0
        let px2 = 0
        const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)
        for (let j = 0; j < cigar.length; j += 2) {
          const idx = j * unitMultiplier2 + 1

          const len = +cigar[j]!
          const op = cigar[j + 1] as keyof typeof colorMap

          if (!continuingFlag) {
            px1 = cx1
            px2 = cx2
          }

          const d1 = len / bpPerPxs[level]!
          const d2 = len / bpPerPxs[level + 1]!

          if (op === 'M' || op === '=' || op === 'X') {
            cx1 += d1 * rev1
            cx2 += d2 * rev2
          } else if (op === 'D' || op === 'N') {
            cx1 += d1 * rev1
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          else if (op === 'I') {
            cx2 += d2 * rev2
          }

          // check that we are even drawing in view here, e.g. that all
          // points are not all less than 0 or greater than width
          if (
            !(
              Math.max(px1, px2, cx1, cx2) < 0 ||
              Math.min(px1, px2, cx1, cx2) > width
            )
          ) {
            // if it is a small feature and not the last element of the
            // CIGAR (which could skip rendering it entire if we did turn
            // it on), then turn on continuing flag
            const isNotLast = j < cigar.length - 2
            if (
              Math.abs(cx1 - px1) <= 1 &&
              Math.abs(cx2 - px2) <= 1 &&
              isNotLast
            ) {
              continuingFlag = true
            } else {
              // allow rendering the dominant color when using continuing
              // flag if the last element of continuing was a large
              // feature, else just use match
              ctx1.fillStyle =
                colorMap[(continuingFlag && d1 > 1) || d2 > 1 ? op : 'M']
              continuingFlag = false

              draw(ctx1, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
              ctx1.fill()
              if (ctx3) {
                ctx3.fillStyle = makeColor(idx)
                draw(ctx3, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                ctx3.fill()
              }
            }
          }
        }
      } else {
        draw(ctx1, x11, x12, y1, x22, x21, y2, mid, drawCurves)
        ctx1.fill()
      }
    }
  }

  // draw click map
  const ctx2 = model.clickMapCanvas?.getContext('2d')
  if (!ctx2) {
    return
  }
  ctx2.imageSmoothingEnabled = false
  ctx2.clearRect(0, 0, width, height)
  for (let i = 0; i < featPositions.length; i++) {
    const feature = featPositions[i]!
    const idx = i * unitMultiplier + 1
    ctx2.fillStyle = makeColor(idx)

    // too many click map false positives with colored stroked lines
    drawMatchSimple({
      cb: ctx => {
        ctx.fill()
      },
      feature,
      ctx: ctx2,
      drawCurves,
      level,
      offsets,
      oobLimit,
      viewWidth: view.width,
      hideTiny: true,
      height,
    })
  }
}

export function drawMouseoverSynteny(model: LinearSyntenyDisplayModel) {
  const { level, clickId, mouseoverId } = model
  const highResolutionScaling = 1
  const view = getContainingView(model) as LinearSyntenyViewModel
  const drawCurves = view.drawCurves
  const height = model.height
  const width = view.width
  const ctx = model.mouseoverCanvas?.getContext('2d')
  const offsets = view.views.map(v => v.offsetPx)

  if (!ctx) {
    return
  }
  ctx.resetTransform()
  ctx.scale(highResolutionScaling, highResolutionScaling)
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
  const feature1 = model.featMap[mouseoverId || '']
  if (feature1) {
    drawMatchSimple({
      cb: ctx => {
        ctx.fill()
      },
      feature: feature1,
      level,
      ctx,
      oobLimit,
      viewWidth: view.width,
      drawCurves,
      offsets,
      height,
    })
  }
  const feature2 = model.featMap[clickId || '']
  if (feature2) {
    drawMatchSimple({
      cb: ctx => {
        ctx.stroke()
      },
      feature: feature2,
      ctx,
      level,
      oobLimit,
      viewWidth: view.width,
      drawCurves,
      offsets,
      height,
    })
  }
}
