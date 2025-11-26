import { getContainingView } from '@jbrowse/core/util'

import { CIGAR_DEL_MASK, CIGAR_I, CIGAR_MATCH_MASK } from '../cigarUtils'
import { MAX_COLOR_RANGE, makeColor } from '../colorUtils'
import { draw } from './components/util'
import { max4, min4 } from './util'

import type { LinearSyntenyDisplayModel } from './model'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

const lineLimit = 3
const oobLimit = 1600

export function drawCigarClickMap(
  model: LinearSyntenyDisplayModel,
  cigarClickMapCanvas: CanvasRenderingContext2D,
) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const drawCurves = view.drawCurves
  const drawCIGAR = view.drawCIGAR
  const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
  const { level, height, featPositions } = model
  const width = view.width
  const bpPerPxs = view.views.map(v => v.bpPerPx)

  cigarClickMapCanvas.imageSmoothingEnabled = false
  cigarClickMapCanvas.clearRect(0, 0, width, height)

  const offsets = view.views.map(v => v.offsetPx)
  const offsetL0 = offsets[level]!
  const offsetL1 = offsets[level + 1]!

  // Cache reciprocals for division in CIGAR loop
  const bpPerPxInv0 = 1 / bpPerPxs[level]!
  const bpPerPxInv1 = 1 / bpPerPxs[level + 1]!

  const y1 = 0
  const y2 = height
  const mid = height / 2
  const widthPlusOob = width + oobLimit

  for (const featPosition of featPositions) {
    const feat = featPosition
    const { p11, p12, p21, p22, f, cigar } = feat

    const x11 = p11.offsetPx - offsetL0
    const x12 = p12.offsetPx - offsetL0
    const x21 = p21.offsetPx - offsetL1
    const x22 = p22.offsetPx - offsetL1
    const l1 = x12 > x11 ? x12 - x11 : x11 - x12
    const l2 = x22 > x21 ? x22 - x21 : x21 - x22

    // Inline doesIntersect2
    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)
    if (l1 <= lineLimit && l2 <= lineLimit) {
      continue
    }
    if (maxX < -oobLimit || minX > widthPlusOob) {
      continue
    }

    const cigarLen = cigar.length
    if (!cigarLen || !drawCIGAR) {
      continue
    }

    const s1 = f.get('strand') as number
    // Use sign bit: s1 < 0 for negative strand check
    const negStrand = s1 < 0
    const k1 = negStrand ? x12 : x11
    const k2 = negStrand ? x11 : x12

    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (x21 < x22 ? 1 : -1) * s1

    let cx1 = k1
    let cx2 = negStrand ? x22 : x21
    let continuingFlag = false
    let px1 = 0
    let px2 = 0
    const unitMultiplier2 = (MAX_COLOR_RANGE / cigarLen) | 0
    const cigarLenMinus1 = cigarLen - 1

    for (let j = 0; j < cigarLen; j++) {
      const packed = cigar[j]!
      const len = packed >> 4
      const op = packed & 0xf

      if (!continuingFlag) {
        px1 = cx1
        px2 = cx2
      }

      const d1 = len * bpPerPxInv0
      const d2 = len * bpPerPxInv1

      if ((1 << op) & CIGAR_MATCH_MASK) {
        cx1 += d1 * rev1
        cx2 += d2 * rev2
      } else if ((1 << op) & CIGAR_DEL_MASK) {
        cx1 += d1 * rev1
      } else if (op === CIGAR_I) {
        cx2 += d2 * rev2
      }

      // Check if in view
      if (max4(px1, px2, cx1, cx2) < 0 || min4(px1, px2, cx1, cx2) > width) {
        continue
      }

      const dx1 = cx1 - px1
      const dx2 = cx2 - px2
      const absDx1 = dx1 > 0 ? dx1 : -dx1
      const absDx2 = dx2 > 0 ? dx2 : -dx2

      if (absDx1 <= 1 && absDx2 <= 1 && j < cigarLenMinus1) {
        continuingFlag = true
      } else {
        continuingFlag = false
        const shouldDraw =
          !drawCIGARMatchesOnly ||
          ((1 << op) & CIGAR_MATCH_MASK && absDx1 > 1 && absDx2 > 1)

        if (shouldDraw) {
          const idx = j * unitMultiplier2 + 1
          cigarClickMapCanvas.fillStyle = makeColor(idx)
          draw(cigarClickMapCanvas, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
          cigarClickMapCanvas.fill()
        }
      }
    }
  }
}
