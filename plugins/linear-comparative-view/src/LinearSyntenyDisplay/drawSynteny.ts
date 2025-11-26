import { getContainingView } from '@jbrowse/core/util'

import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from '../cigarUtils'
import {
  applyAlpha,
  colorSchemes,
  getQueryColor,
  makeColor,
  MAX_COLOR_RANGE,
} from '../colorUtils'
import { draw, drawLocationMarkers, drawMatchSimple } from './components/util'

import type { ColorScheme } from '../colorUtils'
import type { LinearSyntenyDisplayModel, FeatPos } from './model'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

const lineLimit = 3
const oobLimit = 1600

// Reusable callbacks to avoid closure allocation
const fillCallback = (ctx: CanvasRenderingContext2D) => ctx.fill()
const strokeCallback = (ctx: CanvasRenderingContext2D) => ctx.stroke()

// Inline min/max for 4 values to avoid function call overhead
function max4(a: number, b: number, c: number, d: number) {
  let m = a
  if (b > m) {
    m = b
  }
  if (c > m) {
    m = c
  }
  if (d > m) {
    m = d
  }
  return m
}

function min4(a: number, b: number, c: number, d: number) {
  let m = a
  if (b < m) {
    m = b
  }
  if (c < m) {
    m = c
  }
  if (d < m) {
    m = d
  }
  return m
}

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

  for (let i = 0; i < featPositions.length; i++) {
    const feat = featPositions[i]!
    const { p11, p12, p21, p22, f, cigar } = feat

    const x11 = p11.offsetPx - offsetL0
    const x12 = p12.offsetPx - offsetL0
    const x21 = p21.offsetPx - offsetL1
    const x22 = p22.offsetPx - offsetL1
    const l1 = x12 > x11 ? x12 - x11 : x11 - x12
    const l2 = x22 > x21 ? x22 - x21 : x21 - x22

    // Inline doesIntersect2
    const minX = x21 < x22 ? x21 : x22
    const maxX = x21 > x22 ? x21 : x22
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

    const s1 = f.get('strand')
    const k1 = s1 === -1 ? x12 : x11
    const k2 = s1 === -1 ? x11 : x12

    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (x21 < x22 ? 1 : -1) * s1

    let cx1 = k1
    let cx2 = s1 === -1 ? x22 : x21
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

      if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
        cx1 += d1 * rev1
        cx2 += d2 * rev2
      } else if (op === CIGAR_D || op === CIGAR_N) {
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
          ((op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) &&
            absDx1 > 1 &&
            absDx2 > 1)

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

interface FilteredFeature {
  feat: FeatPos
  idx: number
  x11: number
  x12: number
  x21: number
  x22: number
  strand: number
  refName: string
  isThin: boolean
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
  const { level, height, featPositions, alpha, minAlignmentLength, colorBy } =
    model
  const width = view.width
  const bpPerPxs = view.views.map(v => v.bpPerPx)

  // Calculate total alignment length per query sequence if filtering
  let queryTotalLengths: Map<string, number> | null = null
  if (minAlignmentLength > 0) {
    queryTotalLengths = new Map()
    for (let i = 0; i < featPositions.length; i++) {
      const { f } = featPositions[i]!
      const queryName = f.get('name') || f.get('id') || f.id()
      const alignmentLength =
        f.get('end') - f.get('start')
      const absLen = alignmentLength > 0 ? alignmentLength : -alignmentLength
      const currentTotal = queryTotalLengths.get(queryName) || 0
      queryTotalLengths.set(queryName, currentTotal + absLen)
    }
  }

  // Get the appropriate color map for the current scheme
  const schemeConfig =
    colorSchemes[colorBy as ColorScheme] || colorSchemes.default
  const activeColorMap = schemeConfig.cigarColors

  // Define colors for strand-based coloring
  const posColor = colorBy === 'strand' ? colorSchemes.strand.posColor : 'red'
  const negColor = colorBy === 'strand' ? colorSchemes.strand.negColor : 'blue'

  // Precalculate colors with alpha applied
  const colorMapWithAlpha = activeColorMap.map(color =>
    applyAlpha(color, alpha),
  )

  const posColorWithAlpha = applyAlpha(posColor, alpha)
  const negColorWithAlpha = applyAlpha(negColor, alpha)

  // Cache for query colors with alpha applied
  const queryColorCache = new Map<string, string>()
  const getQueryColorWithAlpha = (queryName: string) => {
    let cached = queryColorCache.get(queryName)
    if (!cached) {
      cached = applyAlpha(getQueryColor(queryName), alpha)
      queryColorCache.set(queryName, cached)
    }
    return cached
  }

  const offsets = view.views.map(v => v.offsetPx)
  const offsetL0 = offsets[level]!
  const offsetL1 = offsets[level + 1]!
  const unitMultiplier = (MAX_COLOR_RANGE / featPositions.length) | 0
  const y1 = 0
  const y2 = height
  const mid = height / 2

  const useStrandColor = colorBy === 'strand'
  const useQueryColor = colorBy === 'query'
  const defaultColor = colorMapWithAlpha[CIGAR_M]!

  const widthPlusOob = width + oobLimit

  // Pre-filter and cache feature data in single pass
  const filteredFeatures: FilteredFeature[] = []
  const thinLinesByColor = new Map<string, FilteredFeature[]>()

  for (let i = 0; i < featPositions.length; i++) {
    const feat = featPositions[i]!
    const { p11, p12, p21, p22, f } = feat

    // Cache feature properties
    const strand = f.get('strand') as number
    const refName = f.get('refName') as string

    // Filter by total alignment length
    if (queryTotalLengths) {
      const queryName = f.get('name') || f.get('id') || f.id()
      const totalLength = queryTotalLengths.get(queryName) || 0
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

    const x11 = p11.offsetPx - offsetL0
    const x12 = p12.offsetPx - offsetL0
    const x21 = p21.offsetPx - offsetL1
    const x22 = p22.offsetPx - offsetL1
    const l1 = x12 > x11 ? x12 - x11 : x11 - x12
    const l2 = x22 > x21 ? x22 - x21 : x21 - x22

    const isThin = l1 <= lineLimit && l2 <= lineLimit

    // Inline doesIntersect2 for non-thin features
    if (!isThin) {
      const minX = x21 < x22 ? x21 : x22
      const maxX = x21 > x22 ? x21 : x22
      if (maxX < -oobLimit || minX > widthPlusOob) {
        continue
      }
    } else {
      // For thin lines, simple bounds check
      if (x21 >= widthPlusOob || x21 <= -oobLimit) {
        continue
      }
    }

    const filtered: FilteredFeature = {
      feat,
      idx: i,
      x11,
      x12,
      x21,
      x22,
      strand,
      refName,
      isThin,
    }

    filteredFeatures.push(filtered)

    // Group thin lines by color
    if (isThin) {
      let colorKey = 'default'
      if (useStrandColor) {
        colorKey = strand === -1 ? 'neg' : 'pos'
      } else if (useQueryColor) {
        colorKey = refName
      }

      let arr = thinLinesByColor.get(colorKey)
      if (!arr) {
        arr = []
        thinLinesByColor.set(colorKey, arr)
      }
      arr.push(filtered)
    }
  }

  // Draw thin lines batched by color
  for (const [colorKey, lines] of thinLinesByColor) {
    if (colorKey === 'pos') {
      mainCanvas.strokeStyle = posColorWithAlpha
    } else if (colorKey === 'neg') {
      mainCanvas.strokeStyle = negColorWithAlpha
    } else if (colorKey !== 'default') {
      mainCanvas.strokeStyle = getQueryColorWithAlpha(colorKey)
    } else {
      mainCanvas.strokeStyle = defaultColor
    }

    mainCanvas.beginPath()
    if (drawCurves) {
      for (let i = 0; i < lines.length; i++) {
        const { x11, x21 } = lines[i]!
        mainCanvas.moveTo(x11, y1)
        mainCanvas.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      }
    } else {
      for (let i = 0; i < lines.length; i++) {
        const { x11, x21 } = lines[i]!
        mainCanvas.moveTo(x11, y1)
        mainCanvas.lineTo(x21, y2)
      }
    }
    mainCanvas.stroke()
  }

  // Cache bpPerPx values and reciprocals
  const bpPerPx0 = bpPerPxs[level]!
  const bpPerPx1 = bpPerPxs[level + 1]!
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  // Track current fill style to minimize state changes
  let currentFillStyle = defaultColor
  mainCanvas.fillStyle = currentFillStyle

  // Process thick features with CIGAR
  for (let fi = 0; fi < filteredFeatures.length; fi++) {
    const { feat, x11, x12, x21, x22, strand, refName, isThin } =
      filteredFeatures[fi]!

    if (isThin) {
      continue
    }

    const { cigar } = feat
    const s1 = strand
    const k1 = s1 === -1 ? x12 : x11
    const k2 = s1 === -1 ? x11 : x12

    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (x21 < x22 ? 1 : -1) * s1

    let cx1 = k1
    let cx2 = s1 === -1 ? x22 : x21
    const cigarLen = cigar.length

    if (cigarLen && drawCIGAR) {
      let continuingFlag = false
      let px1 = 0
      let px2 = 0
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

        if (op === CIGAR_M || op === CIGAR_EQ || op === CIGAR_X) {
          cx1 += d1 * rev1
          cx2 += d2 * rev2
        } else if (op === CIGAR_D || op === CIGAR_N) {
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
          const opCode = (continuingFlag && d1 > 1) || d2 > 1 ? op : CIGAR_M
          continuingFlag = false

          const isInsertionOrDeletion =
            opCode === CIGAR_I || opCode === CIGAR_D || opCode === CIGAR_N

          // Determine fill color, minimize fillStyle changes
          let targetFillStyle: string
          if (useStrandColor && !isInsertionOrDeletion) {
            targetFillStyle =
              strand === -1 ? negColorWithAlpha : posColorWithAlpha
          } else if (useQueryColor && !isInsertionOrDeletion) {
            targetFillStyle = getQueryColorWithAlpha(refName)
          } else {
            targetFillStyle = colorMapWithAlpha[opCode]!
          }

          if (targetFillStyle !== currentFillStyle) {
            currentFillStyle = targetFillStyle
            mainCanvas.fillStyle = currentFillStyle
          }

          if (drawCIGARMatchesOnly) {
            if (opCode === CIGAR_M || opCode === CIGAR_EQ || opCode === CIGAR_X) {
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
    } else {
      // No CIGAR - draw simple shape
      let targetFillStyle: string
      if (useStrandColor) {
        targetFillStyle =
          strand === -1 ? negColorWithAlpha : posColorWithAlpha
      } else if (useQueryColor) {
        targetFillStyle = getQueryColorWithAlpha(refName)
      } else {
        targetFillStyle = defaultColor
      }

      if (targetFillStyle !== currentFillStyle) {
        currentFillStyle = targetFillStyle
        mainCanvas.fillStyle = currentFillStyle
      }

      draw(mainCanvas, x11, x12, y1, x22, x21, y2, mid, drawCurves)
      mainCanvas.fill()
    }
  }

  // Draw click map
  const ctx2 = model.clickMapCanvas?.getContext('2d')
  if (!ctx2) {
    return
  }
  ctx2.imageSmoothingEnabled = false
  ctx2.clearRect(0, 0, width, height)

  for (let i = 0; i < filteredFeatures.length; i++) {
    const { feat, idx } = filteredFeatures[i]!
    const colorIdx = idx * unitMultiplier + 1
    ctx2.fillStyle = makeColor(colorIdx)

    drawMatchSimple({
      cb: fillCallback,
      feature: feat,
      ctx: ctx2,
      drawCurves,
      level,
      offsets,
      oobLimit,
      viewWidth: width,
      hideTiny: true,
      height,
    })
  }
}

export function drawMouseoverClickMap(model: LinearSyntenyDisplayModel) {
  const { level, clickId, mouseoverId } = model
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
  ctx.clearRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'

  const feature1 = model.featMap[mouseoverId || '']
  if (feature1) {
    drawMatchSimple({
      cb: fillCallback,
      feature: feature1,
      level,
      ctx,
      oobLimit,
      viewWidth: width,
      drawCurves,
      offsets,
      height,
    })
  }

  const feature2 = model.featMap[clickId || '']
  if (feature2) {
    drawMatchSimple({
      cb: strokeCallback,
      feature: feature2,
      ctx,
      level,
      oobLimit,
      viewWidth: width,
      drawCurves,
      offsets,
      height,
    })
  }
}
