import { category10 } from '@jbrowse/core/ui/colors'
import { doesIntersect2, getContainingView } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import {
  draw,
  drawLocationMarkers,
  drawMatchSimple,
} from './components/util.ts'

import type { LinearSyntenyDisplayModel } from './model.ts'
import type { LinearSyntenyViewModel } from '../LinearSyntenyView/model.ts'

export const MAX_COLOR_RANGE = 255 * 255 * 255 // max color range

function makeColor(idx: number) {
  const r = Math.floor(idx / (255 * 255)) % 255
  const g = Math.floor(idx / 255) % 255
  const b = idx % 255
  return `rgb(${r},${g},${b})`
}

// Simple hash function to generate consistent colors for query names
function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Generate a color from a query name using the category10 color palette
function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}
// Default CIGAR operation colors
const defaultCigarColors = {
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

// Strand-specific CIGAR operation colors (purple deletion instead of blue)
const strandCigarColors = {
  I: '#ff03',
  N: '#a020f0', // Purple for deletion
  D: '#a020f0', // Purple for deletion
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

// SyRI-style colors (based on schneebergerlab/plotsr)
// SYN (syntenic): grey, INV (inversion): orange, TRANS (translocation): green, DUP (duplication): blue
const syriColors = {
  SYN: '#808080', // grey for matches
  INV: '#FFA500', // orange for inversions
  TRANS: '#228B22', // forest green for translocations
  DUP: '#00BBFF', // cyan-blue for duplications
}

// Color scheme configuration
const colorSchemes = {
  default: {
    cigarColors: defaultCigarColors,
  },
  strand: {
    posColor: 'red',
    negColor: 'blue',
    cigarColors: strandCigarColors,
  },
  query: {
    cigarColors: defaultCigarColors,
  },
  syri: {
    cigarColors: defaultCigarColors,
    syriColors,
  },
}

type ColorScheme = keyof typeof colorSchemes

// Classify a synteny feature as SYN, INV, TRANS, or DUP based on syri conventions
// SYN: same chromosome, forward strand
// INV: same chromosome, reverse strand
// TRANS: different chromosomes
// DUP: currently not detected (would need overlap analysis)
function classifySyriType(
  queryRefName: string,
  mateRefName: string,
  strand: number,
): keyof typeof syriColors {
  // Compare refNames to detect translocations
  // Note: This is a simplification - true translocation detection would need
  // to account for chromosome naming differences between assemblies
  if (queryRefName !== mateRefName) {
    return 'TRANS'
  }
  // Same chromosome - check strand for inversion
  if (strand === -1) {
    return 'INV'
  }
  return 'SYN'
}

function applyAlpha(color: string, alpha: number) {
  // Skip colord processing if alpha is 1 (optimization)
  if (alpha === 1) {
    return color
  }
  return colord(color).alpha(alpha).toHex()
}

const lineLimit = 3

const oobLimit = 1600

export function getId(r: number, g: number, b: number, unitMultiplier: number) {
  return Math.floor((r * 255 * 255 + g * 255 + b - 1) / unitMultiplier)
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

  // Cache reciprocals for division in CIGAR loop
  const bpPerPxInv0 = 1 / bpPerPxs[level]!
  const bpPerPxInv1 = 1 / bpPerPxs[level + 1]!

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

      const rev1 = k1 < k2 ? 1 : -1
      const rev2 = (x21 < x22 ? 1 : -1) * s1

      let cx1 = k1
      let cx2 = s1 === -1 ? x22 : x21
      if (cigar.length && drawCIGAR) {
        let continuingFlag = false
        let px1 = 0
        let px2 = 0
        const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)

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

          if (
            !(
              Math.max(px1, px2, cx1, cx2) < 0 ||
              Math.min(px1, px2, cx1, cx2) > width
            )
          ) {
            const isNotLast = j < cigar.length - 2
            if (
              Math.abs(cx1 - px1) <= 1 &&
              Math.abs(cx2 - px2) <= 1 &&
              isNotLast
            ) {
              continuingFlag = true
            } else {
              continuingFlag = false
              // When drawCIGARMatchesOnly is enabled, only draw match operations (M, =, X)
              // Skip insertions (I) and deletions (D, N)
              // Also skip very thin rectangles which tend to be glitchy
              const shouldDraw =
                !drawCIGARMatchesOnly ||
                ((op === 'M' || op === '=' || op === 'X') &&
                  Math.abs(cx1 - px1) > 1 &&
                  Math.abs(cx2 - px2) > 1)

              if (shouldDraw) {
                const idx = j * unitMultiplier2 + 1
                cigarClickMapCanvas.fillStyle = makeColor(idx)
                draw(
                  cigarClickMapCanvas,
                  px1,
                  cx1,
                  y1,
                  cx2,
                  px2,
                  y2,
                  mid,
                  drawCurves,
                )
                cigarClickMapCanvas.fill()
              }
            }
          }
        }
      }
    }
  }
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

  // Calculate total alignment length per query sequence
  // Group by query name and sum up all alignment lengths
  const queryTotalLengths = new Map<string, number>()
  if (minAlignmentLength > 0) {
    for (const { f } of featPositions) {
      const queryName = f.get('name') || f.get('id') || f.id()
      const alignmentLength = Math.abs(f.get('end') - f.get('start'))
      const currentTotal = queryTotalLengths.get(queryName) || 0
      queryTotalLengths.set(queryName, currentTotal + alignmentLength)
    }
  }

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

  // Precalculate syri colors with alpha
  const useSyriColor = colorBy === 'syri'
  const syriColorsWithAlpha = useSyriColor
    ? {
        SYN: applyAlpha(syriColors.SYN, alpha),
        INV: applyAlpha(syriColors.INV, alpha),
        TRANS: applyAlpha(syriColors.TRANS, alpha),
        DUP: applyAlpha(syriColors.DUP, alpha),
      }
    : null

  // Cache for query colors with alpha applied
  const queryColorCache = new Map<string, string>()

  const getQueryColorWithAlpha = (queryName: string) => {
    if (!queryColorCache.has(queryName)) {
      const color = getQueryColor(queryName)
      queryColorCache.set(queryName, applyAlpha(color, alpha))
    }
    return queryColorCache.get(queryName)!
  }

  mainCanvas.beginPath()
  const offsets = view.views.map(v => v.offsetPx)
  const offsetsL0 = offsets[level]!
  const offsetsL1 = offsets[level + 1]!
  const unitMultiplier = Math.floor(MAX_COLOR_RANGE / featPositions.length)
  const y1 = 0
  const y2 = height
  const mid = (y2 - y1) / 2

  // Cache colorBy checks outside loop for performance
  const useStrandColorThin = colorBy === 'strand'
  const useQueryColorThin = colorBy === 'query'
  const useSyriColorThin = colorBy === 'syri'

  mainCanvas.fillStyle = colorMapWithAlpha.M
  mainCanvas.strokeStyle = colorMapWithAlpha.M

  // Group features by color to batch state changes
  const thinLinesByColor = new Map<
    string,
    { x11: number; x21: number; y1: number; y2: number; mid: number }[]
  >()

  for (const { p11, p12, p21, p22, f } of featPositions) {
    // Filter by total alignment length for this query sequence
    if (minAlignmentLength > 0) {
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

    // drawing a line if the results are thin results in much less pixellation
    // than filling in a thin polygon
    if (
      l1 <= lineLimit &&
      l2 <= lineLimit &&
      x21 < width + oobLimit &&
      x21 > -oobLimit
    ) {
      // Determine color key for batching
      let colorKey = 'default'
      if (useStrandColorThin) {
        const strand = f.get('strand')
        colorKey = strand === -1 ? 'neg' : 'pos'
      } else if (useQueryColorThin) {
        colorKey = f.get('refName')
      } else if (useSyriColorThin) {
        const strand = f.get('strand')
        const queryRefName = f.get('refName')
        const mate = f.get('mate')
        const mateRefName = mate?.refName
        colorKey = `syri_${classifySyriType(queryRefName, mateRefName, strand)}`
      }

      if (!thinLinesByColor.has(colorKey)) {
        thinLinesByColor.set(colorKey, [])
      }
      thinLinesByColor.get(colorKey)!.push({ x11, x21, y1, y2, mid })
    }
  }

  // Now draw all thin lines batched by color
  for (const [colorKey, lines] of thinLinesByColor) {
    // Set color once for all lines in this batch
    if (colorKey === 'pos') {
      mainCanvas.strokeStyle = posColorWithAlpha
    } else if (colorKey === 'neg') {
      mainCanvas.strokeStyle = negColorWithAlpha
    } else if (colorKey.startsWith('syri_')) {
      const syriType = colorKey.slice(5) as keyof typeof syriColors
      mainCanvas.strokeStyle = syriColorsWithAlpha![syriType]
    } else if (colorKey !== 'default') {
      mainCanvas.strokeStyle = getQueryColorWithAlpha(colorKey)
    } else {
      mainCanvas.strokeStyle = colorMapWithAlpha.M
    }

    // Create single path for all lines with same color
    mainCanvas.beginPath()
    if (drawCurves) {
      for (const { x11, x21, y1, y2, mid } of lines) {
        mainCanvas.moveTo(x11, y1)
        mainCanvas.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      }
    } else {
      for (const { x11, x21, y1, y2 } of lines) {
        mainCanvas.moveTo(x11, y1)
        mainCanvas.lineTo(x21, y2)
      }
    }
    mainCanvas.stroke()
  }

  // Cache bpPerPx values and reciprocals for division in CIGAR loop
  const bpPerPx0 = bpPerPxs[level]!
  const bpPerPx1 = bpPerPxs[level + 1]!
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1

  // Cache colorBy checks outside loop for performance
  const useStrandColor = colorBy === 'strand'
  const useQueryColor = colorBy === 'query'

  mainCanvas.fillStyle = colorMapWithAlpha.M
  mainCanvas.strokeStyle = colorMapWithAlpha.M
  for (const { p11, p12, p21, p22, f, cigar } of featPositions) {
    // Cache feature properties at loop start
    const strand = f.get('strand')
    const refName = f.get('refName')
    const mate = useSyriColor ? f.get('mate') : null
    const mateRefName = mate?.refName

    // Filter by total alignment length for this query sequence
    if (minAlignmentLength > 0) {
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

    if (
      !(l1 <= lineLimit && l2 <= lineLimit) &&
      doesIntersect2(minX, maxX, -oobLimit, view.width + oobLimit)
    ) {
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
              } else if (useSyriColor && !isInsertionOrDeletion) {
                const syriType = classifySyriType(refName, mateRefName, strand)
                mainCanvas.fillStyle = syriColorsWithAlpha![syriType]
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
        } else if (useSyriColor) {
          const syriType = classifySyriType(refName, mateRefName, strand)
          mainCanvas.fillStyle = syriColorsWithAlpha![syriType]
        }

        draw(mainCanvas, x11, x12, y1, x22, x21, y2, mid, drawCurves)
        mainCanvas.fill()

        // Reset to default color if needed
        if (useStrandColor || useQueryColor || useSyriColor) {
          mainCanvas.fillStyle = colorMapWithAlpha.M
        }
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

  // eslint-disable-next-line unicorn/no-for-loop
  for (let i = 0; i < featPositions.length; i++) {
    const feature = featPositions[i]!

    // Filter by total alignment length for this query sequence
    if (minAlignmentLength > 0) {
      const queryName =
        feature.f.get('name') || feature.f.get('id') || feature.f.id()
      const totalLength = queryTotalLengths.get(queryName) || 0
      if (totalLength < minAlignmentLength) {
        continue
      }
    }

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

export function drawMouseoverClickMap(model: LinearSyntenyDisplayModel) {
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
