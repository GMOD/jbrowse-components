import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from '@jbrowse/alignments-core'
import { doesIntersect2, getContainingView } from '@jbrowse/core/util'

import {
  buildViewProjection,
  projectBpToScreenPx,
} from '@jbrowse/core/util/bpProjection'

import { draw, drawLocationMarkers } from './components/util.ts'
import { OP_TO_CIGAR_KEY, lineLimit, oobLimit } from './drawSyntenyUtils.ts'

import type { CanvasLike } from './components/util.ts'
import type { defaultCigarColors } from './drawSyntenyUtils.ts'
import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

export function drawRef(
  model: LinearSyntenyDisplayModel,
  mainCanvas: CanvasLike,
) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const drawCurves = view.drawCurves
  const drawCIGAR = view.drawCIGAR
  const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
  const drawLocationMarkersEnabled = view.drawLocationMarkers
  const { level, height, featureData, minAlignmentLength, colorBy } = model
  const width = view.width

  if (!featureData) {
    return
  }

  if (level + 1 >= view.views.length) {
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

  const v0 = view.views[level]!
  const v1 = view.views[level + 1]!
  const projTop = buildViewProjection(v0)
  const projBot = buildViewProjection(v1)

  const y1 = 0
  const y2 = height
  const mid = (y2 - y1) / 2

  const useStrandColor = colorBy === 'strand'
  const useQueryColor = colorBy === 'query'

  const bpPerPxInv0 = 1 / v0.bpPerPx
  const bpPerPxInv1 = 1 / v1.bpPerPx

  mainCanvas.fillStyle = colorMapWithAlpha.M
  mainCanvas.strokeStyle = colorMapWithAlpha.M

  const featureCount = featureData.featureIds.length
  for (let fi = 0; fi < featureCount; fi++) {
    const strand = featureData.strands[fi]!
    const refName = featureData.refNames[fi]!

    if (queryTotalLengths) {
      const name = featureData.names[fi]!
      const totalLength =
        name !== ''
          ? queryTotalLengths.get(name)!
          : Math.abs(featureData.ends[fi]! - featureData.starts[fi]!)
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

    const topIdx = featureData.topRegionIdx[fi]!
    const botIdx = featureData.botRegionIdx[fi]!
    const x11 = projectBpToScreenPx(featureData.p11_bp[fi]!, topIdx, projTop)
    const x12 = projectBpToScreenPx(featureData.p12_bp[fi]!, topIdx, projTop)
    const x21 = projectBpToScreenPx(featureData.p21_bp[fi]!, botIdx, projBot)
    const x22 = projectBpToScreenPx(featureData.p22_bp[fi]!, botIdx, projBot)
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
        // NOTE: mirrors the worker loop in buildSyntenyGeometry.ts. Keep in sync.
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

          if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
            cx1 += d1 * rev1
            cx2 += d2 * rev2
          } else if (op === CIGAR_D || op === CIGAR_N) {
            cx1 += d1 * rev1
          } else if (op === CIGAR_I) {
            cx2 += d2 * rev2
          }

          if (op === CIGAR_D || op === CIGAR_N || op === CIGAR_I) {
            const relevantPx = op === CIGAR_I ? d2 : d1
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
                (continuingFlag && d1 > 1) || d2 > 1 ? op : CIGAR_M
              const letter = OP_TO_CIGAR_KEY[resolvedOp] || 'M'

              const isInsertionOrDeletion =
                resolvedOp === CIGAR_I ||
                resolvedOp === CIGAR_D ||
                resolvedOp === CIGAR_N
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

              if (!drawCIGARMatchesOnly || letter === 'M') {
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
      }
    }
  }
}
