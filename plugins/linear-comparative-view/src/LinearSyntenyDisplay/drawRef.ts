import { doesIntersect2, getContainingView } from '@jbrowse/core/util'

import {
  draw,
  drawLocationMarkers,
  drawMatchSimple,
} from './components/util.ts'
import {
  MAX_COLOR_RANGE,
  applyAlpha,
  colorSchemes,
  getQueryColor,
  lineLimit,
  makeColor,
  oobLimit,
} from './drawSyntenyUtils.ts'

import type { ColorScheme, defaultCigarColors } from './drawSyntenyUtils.ts'
import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

export function drawRef(
  model: LinearSyntenyDisplayModel,
  mainCanvas: CanvasRenderingContext2D,
) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const drawCurves = view.drawCurves
  const drawCIGAR = view.drawCIGAR
  const drawCIGARMatchesOnly = view.drawCIGARMatchesOnly
  const drawLocationMarkersEnabled = view.drawLocationMarkers
  const { level, height, featPositions, alpha, minAlignmentLength, colorBy } =
    model
  const width = view.width
  const bpPerPxs = view.views.map(v => v.bpPerPx)

  // Get the appropriate color map for the current scheme
  const schemeConfig =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    colorSchemes[colorBy as ColorScheme] || colorSchemes.default
  const activeColorMap = schemeConfig.cigarColors

  // Define colors for strand-based coloring
  const posColor = colorBy === 'strand' ? colorSchemes.strand.posColor : 'red'
  const negColor = colorBy === 'strand' ? colorSchemes.strand.negColor : 'blue'

  // Precalculate colors with alpha applied to avoid repeated calls
  const colorMapWithAlpha = {
    I: applyAlpha(activeColorMap.I, alpha),
    N: applyAlpha(activeColorMap.N, alpha),
    D: applyAlpha(activeColorMap.D, alpha),
    X: applyAlpha(activeColorMap.X, alpha),
    M: applyAlpha(activeColorMap.M, alpha),
    '=': applyAlpha(activeColorMap['='], alpha),
  }

  // Precalculate strand colors with alpha
  const posColorWithAlpha = applyAlpha(posColor, alpha)
  const negColorWithAlpha = applyAlpha(negColor, alpha)

  // Cache for query colors with alpha applied
  const queryColorCache = new Map<string, string>()

  const getQueryColorWithAlpha = (queryName: string) => {
    if (!queryColorCache.has(queryName)) {
      const color = getQueryColor(queryName)
      queryColorCache.set(queryName, applyAlpha(color, alpha))
    }
    return queryColorCache.get(queryName)!
  }

  const offsets = view.views.map(v => v.offsetPx)
  const offsetsL0 = offsets[level]!
  const offsetsL1 = offsets[level + 1]!

  // Pre-calculate query total lengths for filtering
  let queryTotalLengths: Map<string, number> | undefined
  if (minAlignmentLength > 0) {
    queryTotalLengths = new Map<string, number>()
    for (const { f } of featPositions) {
      const queryName = f.get('name') || f.get('id') || f.id()
      const alignmentLength = Math.abs(f.get('end') - f.get('start'))
      const currentTotal = queryTotalLengths.get(queryName) || 0
      queryTotalLengths.set(queryName, currentTotal + alignmentLength)
    }
  }

  const unitMultiplier = Math.floor(MAX_COLOR_RANGE / featPositions.length)
  const y1 = 0
  const y2 = height
  const mid = (y2 - y1) / 2

  // Cache colorBy checks outside loop for performance
  const useStrandColor = colorBy === 'strand'
  const useQueryColor = colorBy === 'query'

  // Cache bpPerPx values and reciprocals for division in CIGAR loop
  const bpPerPx0 = bpPerPxs[level]!
  const bpPerPx1 = bpPerPxs[level + 1]!
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  // Get click map context once
  const clickMapCtx = model.clickMapCanvas?.getContext('2d')
  if (clickMapCtx) {
    clickMapCtx.imageSmoothingEnabled = false
    clickMapCtx.clearRect(0, 0, width, height)
  }

  mainCanvas.fillStyle = colorMapWithAlpha.M
  mainCanvas.strokeStyle = colorMapWithAlpha.M

  // Single loop over features - draw main canvas and click map together
  for (const [i, featPosition] of featPositions.entries()) {
    const feature = featPosition
    const { p11, p12, p21, p22, f, cigar } = feature

    // Cache feature properties
    const strand = f.get('strand')
    const refName = f.get('refName')

    // Filter by minAlignmentLength if enabled
    if (queryTotalLengths) {
      const queryName = f.get('name') || f.get('id') || f.id()
      const totalLength = queryTotalLengths.get(queryName) || 0
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

    const x11 = p11.offsetPx - offsetsL0
    const x12 = p12.offsetPx - offsetsL0
    const x21 = p21.offsetPx - offsetsL1
    const x22 = p22.offsetPx - offsetsL1
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)
    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)

    // Draw thin lines (when both dimensions are small)
    if (
      l1 <= lineLimit &&
      l2 <= lineLimit &&
      x21 < width + oobLimit &&
      x21 > -oobLimit
    ) {
      // Set color for this line
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
    }
    // Draw thick features
    else if (doesIntersect2(minX, maxX, -oobLimit, view.width + oobLimit)) {
      const s1 = strand
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

        for (let j = 0; j < cigar.length; j += 2) {
          const len = +cigar[j]!
          const op = cigar[j + 1] as keyof typeof defaultCigarColors

          if (!continuingFlag) {
            px1 = cx1
            px2 = cx2
          }

          const d1 = len * bpPerPxInv0
          const d2 = len * bpPerPxInv1

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
              const letter = (continuingFlag && d1 > 1) || d2 > 1 ? op : 'M'

              // Use custom coloring based on colorBy setting
              // Always keep yellow/blue for insertions/deletions regardless of colorBy
              const isInsertionOrDeletion =
                letter === 'I' || letter === 'D' || letter === 'N'
              if (useStrandColor && !isInsertionOrDeletion) {
                mainCanvas.fillStyle =
                  strand === -1 ? negColorWithAlpha : posColorWithAlpha
              } else if (useQueryColor && !isInsertionOrDeletion) {
                mainCanvas.fillStyle = getQueryColorWithAlpha(refName)
              } else {
                mainCanvas.fillStyle = colorMapWithAlpha[letter]
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
        // Use custom coloring based on colorBy setting
        if (useStrandColor) {
          mainCanvas.fillStyle =
            strand === -1 ? negColorWithAlpha : posColorWithAlpha
        } else if (useQueryColor) {
          mainCanvas.fillStyle = getQueryColorWithAlpha(refName)
        }

        draw(mainCanvas, x11, x12, y1, x22, x21, y2, mid, drawCurves)
        mainCanvas.fill()

        // Reset to default color if needed
        if (useStrandColor || useQueryColor) {
          mainCanvas.fillStyle = colorMapWithAlpha.M
        }
      }
    }

    // Draw to click map (for all visible features, not just thick ones)
    if (clickMapCtx) {
      const idx = i * unitMultiplier + 1
      clickMapCtx.fillStyle = makeColor(idx)

      drawMatchSimple({
        cb: ctx => {
          ctx.fill()
        },
        feature,
        ctx: clickMapCtx,
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
}
