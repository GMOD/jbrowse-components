import { doesIntersect2, getContainingView } from '@jbrowse/core/util'

import { draw, drawLocationMarkers } from './components/util.ts'
import { lineLimit, oobLimit } from './drawSyntenyUtils.ts'

import type { defaultCigarColors } from './drawSyntenyUtils.ts'
import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

const OP_M = 0
const OP_I = 1
const OP_D = 2
const OP_N = 3
const OP_EQ = 7
const OP_X = 8

const OP_TO_CIGAR_KEY: Record<number, string> = {
  [OP_M]: 'M',
  [OP_I]: 'I',
  [OP_D]: 'D',
  [OP_N]: 'N',
  [OP_EQ]: '=',
  [OP_X]: 'X',
}

export function drawRef(
  model: LinearSyntenyDisplayModel,
  mainCanvas: CanvasRenderingContext2D,
) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const drawCurves = view.drawCurves
  const drawCIGAR = view.drawCIGAR
  const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
  const drawLocationMarkersEnabled = view.drawLocationMarkers
  const { level, height, featureData, minAlignmentLength, colorBy } = model
  const width = view.width
  const bpPerPxs = view.views.map(v => v.bpPerPx)

  if (!featureData) {
    return
  }

  const parsedCigars = model.parsedCigars
  if (!parsedCigars) {
    return
  }

  const colorMapWithAlpha = model.colorMapWithAlpha
  const posColorWithAlpha = model.posColorWithAlpha
  const negColorWithAlpha = model.negColorWithAlpha
  const getQueryColorWithAlpha = model.queryColorWithAlphaMap
  const queryTotalLengths = model.queryTotalLengths

  const offsets = view.views.map(v => v.offsetPx)
  const offsetsL0 = offsets[level]!
  const offsetsL1 = offsets[level + 1]!

  const y1 = 0
  const y2 = height
  const mid = (y2 - y1) / 2

  const useStrandColor = colorBy === 'strand'
  const useQueryColor = colorBy === 'query'

  const bpPerPx0 = bpPerPxs[level]!
  const bpPerPx1 = bpPerPxs[level + 1]!
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  mainCanvas.fillStyle = colorMapWithAlpha.M
  mainCanvas.strokeStyle = colorMapWithAlpha.M

  const featureCount = featureData.featureIds.length
  for (let fi = 0; fi < featureCount; fi++) {
    const strand = featureData.strands[fi]!
    const refName = featureData.refNames[fi]!

    if (queryTotalLengths) {
      const queryName = featureData.names[fi] || featureData.featureIds[fi]!
      const totalLength = queryTotalLengths.get(queryName) || 0
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

    const x11 = featureData.p11_offsetPx[fi]! - offsetsL0
    const x12 = featureData.p12_offsetPx[fi]! - offsetsL0
    const x21 = featureData.p21_offsetPx[fi]! - offsetsL1
    const x22 = featureData.p22_offsetPx[fi]! - offsetsL1
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)
    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)

    if (
      l1 <= lineLimit &&
      l2 <= lineLimit &&
      x21 < width + oobLimit &&
      x21 > -oobLimit
    ) {
      if (useStrandColor) {
        mainCanvas.strokeStyle =
          strand === -1 ? negColorWithAlpha : posColorWithAlpha
      } else if (useQueryColor) {
        mainCanvas.strokeStyle = getQueryColorWithAlpha(refName)
      } else {
        mainCanvas.strokeStyle = colorMapWithAlpha.M
      }

      mainCanvas.beginPath()
      mainCanvas.moveTo(x11, y1)
      if (drawCurves) {
        mainCanvas.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      } else {
        mainCanvas.lineTo(x21, y2)
      }
      mainCanvas.stroke()
    } else if (doesIntersect2(minX, maxX, -oobLimit, view.width + oobLimit)) {
      const s1 = strand
      const k1 = s1 === -1 ? x12 : x11
      const k2 = s1 === -1 ? x11 : x12

      const rev1 = k1 < k2 ? 1 : -1
      const rev2 = (x21 < x22 ? 1 : -1) * s1

      let cx1 = k1
      let cx2 = s1 === -1 ? x22 : x21
      const cigar = parsedCigars[fi]!
      if (cigar.length > 0 && drawCIGAR) {
        let continuingFlag = false
        let px1 = 0
        let px2 = 0

        for (let j = 0; j < cigar.length; j++) {
          const packed = cigar[j]!
          const len = packed >>> 4
          const op = packed & 0xf

          if (!continuingFlag) {
            px1 = cx1
            px2 = cx2
          }

          const d1 = len * bpPerPxInv0
          const d2 = len * bpPerPxInv1

          if (op === OP_M || op === OP_EQ || op === OP_X) {
            cx1 += d1 * rev1
            cx2 += d2 * rev2
          } else if (op === OP_D || op === OP_N) {
            cx1 += d1 * rev1
          } else if (op === OP_I) {
            cx2 += d2 * rev2
          }

          if (op === OP_D || op === OP_N || op === OP_I) {
            const relevantPx = op === OP_I ? d2 : d1
            if (relevantPx < 1) {
              continuingFlag = true
              continue
            }
          }

          if (
            !(
              Math.max(px1, px2, cx1, cx2) < 0 ||
              Math.min(px1, px2, cx1, cx2) > width
            )
          ) {
            const isNotLast = j < cigar.length - 1
            if (
              Math.abs(cx1 - px1) <= 1 &&
              Math.abs(cx2 - px2) <= 1 &&
              isNotLast
            ) {
              continuingFlag = true
            } else {
              const resolvedOp =
                (continuingFlag && d1 > 1) || d2 > 1 ? op : OP_M
              const letter = OP_TO_CIGAR_KEY[resolvedOp] || 'M'

              const isInsertionOrDeletion =
                resolvedOp === OP_I || resolvedOp === OP_D || resolvedOp === OP_N
              if (useStrandColor && !isInsertionOrDeletion) {
                mainCanvas.fillStyle =
                  strand === -1 ? negColorWithAlpha : posColorWithAlpha
              } else if (useQueryColor && !isInsertionOrDeletion) {
                mainCanvas.fillStyle = getQueryColorWithAlpha(refName)
              } else {
                mainCanvas.fillStyle =
                  colorMapWithAlpha[letter as keyof typeof defaultCigarColors]
              }

              continuingFlag = false

              if (drawCIGARMatchesOnly) {
                if (letter === 'M') {
                  draw(mainCanvas, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                  mainCanvas.fill()
                  if (drawLocationMarkersEnabled) {
                    drawLocationMarkers(
                      mainCanvas,
                      px1,
                      cx1,
                      y1,
                      cx2,
                      px2,
                      y2,
                      mid,
                      bpPerPx0,
                      bpPerPx1,
                      drawCurves,
                    )
                  }
                }
              } else {
                draw(mainCanvas, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
                mainCanvas.fill()
                if (drawLocationMarkersEnabled) {
                  drawLocationMarkers(
                    mainCanvas,
                    px1,
                    cx1,
                    y1,
                    cx2,
                    px2,
                    y2,
                    mid,
                    bpPerPx0,
                    bpPerPx1,
                    drawCurves,
                  )
                }
              }
            }
          }
        }
      } else {
        if (useStrandColor) {
          mainCanvas.fillStyle =
            strand === -1 ? negColorWithAlpha : posColorWithAlpha
        } else if (useQueryColor) {
          mainCanvas.fillStyle = getQueryColorWithAlpha(refName)
        }

        draw(mainCanvas, x11, x12, y1, x22, x21, y2, mid, drawCurves)
        mainCanvas.fill()

        if (useStrandColor || useQueryColor) {
          mainCanvas.fillStyle = colorMapWithAlpha.M
        }
      }
    }
  }
}
