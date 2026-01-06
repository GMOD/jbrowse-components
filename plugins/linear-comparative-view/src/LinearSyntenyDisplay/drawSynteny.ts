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

// CIGAR operation colors (used for insertions/deletions in all color modes)
const cigarColors = {
  I: '#ff03', // yellow - insertion
  N: '#0a03', // green - skipped region
  D: '#00f3', // blue - deletion
  X: 'brown', // mismatch
  M: '#f003', // red - match (default)
  '=': '#f003', // red - sequence match
}

// SyRI-style colors (based on schneebergerlab/plotsr)
const syriColors = {
  SYN: '#808080', // grey for syntenic matches
  INV: '#FFA500', // orange for inversions
  TRANS: '#228B22', // forest green for translocations
  DUP: '#00BBFF', // cyan-blue for duplications
}

// Strand colors
const strandColors = {
  pos: 'red',
  neg: 'blue',
}

type SyriType = keyof typeof syriColors
type CigarOp = keyof typeof cigarColors

// Normalize chromosome name for comparison across assemblies
// Handles common variations: chr1/1/Chr1/CHR1, chrM/MT/M, etc.
function normalizeChromosomeName(name: string): string {
  if (!name) {
    return ''
  }
  // Remove common prefixes (case-insensitive)
  let normalized = name.replace(/^chr/i, '')
  // Normalize mitochondrial chromosome names
  if (normalized === 'M' || normalized === 'MT' || normalized === 'Mt') {
    normalized = 'M'
  }
  // Normalize to lowercase for comparison
  return normalized.toLowerCase()
}

// Classify a synteny feature as SYN, INV, TRANS, or DUP based on syri conventions
function classifySyriType(
  queryRefName: string,
  mateRefName: string | undefined,
  strand: number,
): SyriType {
  // Compare normalized refNames to detect translocations
  const normalizedQuery = normalizeChromosomeName(queryRefName)
  const normalizedMate = normalizeChromosomeName(mateRefName || '')

  if (normalizedQuery !== normalizedMate) {
    return 'TRANS'
  }
  // Same chromosome - check strand for inversion
  if (strand === -1) {
    return 'INV'
  }
  return 'SYN'
}

function applyAlpha(color: string, alpha: number) {
  if (alpha === 1) {
    return color
  }
  return colord(color).alpha(alpha).toHex()
}

// Process a CIGAR operation and update positions
// Returns the new cx1, cx2 values
function processCigarOp(
  op: string,
  len: number,
  cx1: number,
  cx2: number,
  rev1: number,
  rev2: number,
  bpPerPxInv0: number,
  bpPerPxInv1: number,
): [number, number] {
  const d1 = len * bpPerPxInv0
  const d2 = len * bpPerPxInv1

  if (op === 'M' || op === '=' || op === 'X') {
    return [cx1 + d1 * rev1, cx2 + d2 * rev2]
  }
  if (op === 'D' || op === 'N') {
    return [cx1 + d1 * rev1, cx2]
  }
  if (op === 'I') {
    return [cx1, cx2 + d2 * rev2]
  }
  return [cx1, cx2]
}

const lineLimit = 3
const oobLimit = 1600

export function getId(r: number, g: number, b: number, unitMultiplier: number) {
  return Math.floor((r * 255 * 255 + g * 255 + b - 1) / unitMultiplier)
}

// Color resolver that handles all colorBy modes
interface ColorResolver {
  getMatchColor: (
    strand: number,
    refName: string,
    mateRefName: string | undefined,
  ) => string
  getCigarColor: (op: CigarOp) => string
  defaultColor: string
}

function createColorResolver(
  colorBy: string,
  alpha: number,
  queryColorCache: Map<string, string>,
): ColorResolver {
  // Pre-calculate colors with alpha for the active mode only
  const cigarColorsWithAlpha = {
    I: applyAlpha(cigarColors.I, alpha),
    N: applyAlpha(cigarColors.N, alpha),
    D: applyAlpha(cigarColors.D, alpha),
    X: applyAlpha(cigarColors.X, alpha),
    M: applyAlpha(cigarColors.M, alpha),
    '=': applyAlpha(cigarColors['='], alpha),
  }

  const defaultColor = cigarColorsWithAlpha.M

  const getQueryColorWithAlpha = (queryName: string) => {
    if (!queryColorCache.has(queryName)) {
      queryColorCache.set(queryName, applyAlpha(getQueryColor(queryName), alpha))
    }
    return queryColorCache.get(queryName)!
  }

  if (colorBy === 'strand') {
    const posColor = applyAlpha(strandColors.pos, alpha)
    const negColor = applyAlpha(strandColors.neg, alpha)
    return {
      getMatchColor: strand => (strand === -1 ? negColor : posColor),
      getCigarColor: op => cigarColorsWithAlpha[op],
      defaultColor,
    }
  }

  if (colorBy === 'query') {
    return {
      getMatchColor: (_strand, refName) => getQueryColorWithAlpha(refName),
      getCigarColor: op => cigarColorsWithAlpha[op],
      defaultColor,
    }
  }

  if (colorBy === 'syri') {
    const syriColorsWithAlpha = {
      SYN: applyAlpha(syriColors.SYN, alpha),
      INV: applyAlpha(syriColors.INV, alpha),
      TRANS: applyAlpha(syriColors.TRANS, alpha),
      DUP: applyAlpha(syriColors.DUP, alpha),
    }
    return {
      getMatchColor: (strand, refName, mateRefName) => {
        const syriType = classifySyriType(refName, mateRefName, strand)
        return syriColorsWithAlpha[syriType]
      },
      getCigarColor: op => cigarColorsWithAlpha[op],
      defaultColor,
    }
  }

  // Default mode - use CIGAR colors for everything
  return {
    getMatchColor: () => defaultColor,
    getCigarColor: op => cigarColorsWithAlpha[op],
    defaultColor,
  }
}

export function drawCigarClickMap(
  model: LinearSyntenyDisplayModel,
  cigarClickMapCanvas: CanvasRenderingContext2D,
) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const { drawCurves, drawCIGAR, drawCIGARMatchesOnly, width } = view
  const { level, height, featPositions } = model
  const bpPerPxs = view.views.map(v => v.bpPerPx)

  cigarClickMapCanvas.imageSmoothingEnabled = false
  cigarClickMapCanvas.clearRect(0, 0, width, height)

  const offsets = view.views.map(v => v.offsetPx)
  const offsetL0 = offsets[level]!
  const offsetL1 = offsets[level + 1]!
  const bpPerPxInv0 = 1 / bpPerPxs[level]!
  const bpPerPxInv1 = 1 / bpPerPxs[level + 1]!
  const y1 = 0
  const y2 = height
  const mid = height / 2

  for (const { p11, p12, p21, p22, f, cigar } of featPositions) {
    const x11 = p11.offsetPx - offsetL0
    const x12 = p12.offsetPx - offsetL0
    const x21 = p21.offsetPx - offsetL1
    const x22 = p22.offsetPx - offsetL1
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)
    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)

    if (
      l1 <= lineLimit &&
      l2 <= lineLimit
    ) {
      continue
    }
    if (!doesIntersect2(minX, maxX, -oobLimit, width + oobLimit)) {
      continue
    }
    if (!cigar.length || !drawCIGAR) {
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
    const unitMultiplier2 = Math.floor(MAX_COLOR_RANGE / cigar.length)

    for (let j = 0; j < cigar.length; j += 2) {
      const len = +cigar[j]!
      const op = cigar[j + 1]!

      if (!continuingFlag) {
        px1 = cx1
        px2 = cx2
      }

      ;[cx1, cx2] = processCigarOp(
        op,
        len,
        cx1,
        cx2,
        rev1,
        rev2,
        bpPerPxInv0,
        bpPerPxInv1,
      )

      // Skip if entirely out of view
      if (
        Math.max(px1, px2, cx1, cx2) < 0 ||
        Math.min(px1, px2, cx1, cx2) > width
      ) {
        continue
      }

      const isNotLast = j < cigar.length - 2
      if (
        Math.abs(cx1 - px1) <= 1 &&
        Math.abs(cx2 - px2) <= 1 &&
        isNotLast
      ) {
        continuingFlag = true
        continue
      }

      continuingFlag = false
      const isMatch = op === 'M' || op === '=' || op === 'X'
      const shouldDraw =
        !drawCIGARMatchesOnly ||
        (isMatch && Math.abs(cx1 - px1) > 1 && Math.abs(cx2 - px2) > 1)

      if (shouldDraw) {
        const idx = j * unitMultiplier2 + 1
        cigarClickMapCanvas.fillStyle = makeColor(idx)
        draw(cigarClickMapCanvas, px1, cx1, y1, cx2, px2, y2, mid, drawCurves)
        cigarClickMapCanvas.fill()
      }
    }
  }
}

export function drawRef(
  model: LinearSyntenyDisplayModel,
  mainCanvas: CanvasRenderingContext2D,
) {
  const view = getContainingView(model) as LinearSyntenyViewModel
  const {
    drawCurves,
    drawCIGAR,
    drawCIGARMatchesOnly,
    drawLocationMarkers: drawLocationMarkersEnabled,
    width,
  } = view
  const { level, height, featPositions, alpha, minAlignmentLength, colorBy } =
    model
  const bpPerPxs = view.views.map(v => v.bpPerPx)
  const offsets = view.views.map(v => v.offsetPx)
  const offsetL0 = offsets[level]!
  const offsetL1 = offsets[level + 1]!
  const bpPerPx0 = bpPerPxs[level]!
  const bpPerPx1 = bpPerPxs[level + 1]!
  const bpPerPxInv0 = 1 / bpPerPx0
  const bpPerPxInv1 = 1 / bpPerPx1
  const y1 = 0
  const y2 = height
  const mid = height / 2

  // Pre-filter features by minAlignmentLength (improvement #3)
  let filteredPositions = featPositions
  if (minAlignmentLength > 0) {
    const queryTotalLengths = new Map<string, number>()
    for (const { f } of featPositions) {
      const queryName = f.get('name') || f.get('id') || f.id()
      const alignmentLength = Math.abs(f.get('end') - f.get('start'))
      const currentTotal = queryTotalLengths.get(queryName) || 0
      queryTotalLengths.set(queryName, currentTotal + alignmentLength)
    }
    filteredPositions = featPositions.filter(({ f }) => {
      const queryName = f.get('name') || f.get('id') || f.id()
      return (queryTotalLengths.get(queryName) || 0) >= minAlignmentLength
    })
  }

  // Create color resolver (handles all colorBy modes - improvement #8)
  const queryColorCache = new Map<string, string>()
  const colors = createColorResolver(colorBy, alpha, queryColorCache)
  const useCustomColor = colorBy !== 'default'

  // Group thin features by color for batched drawing
  const thinLinesByColor = new Map<
    string,
    { x11: number; x21: number }[]
  >()

  for (const { p11, p12, p21, p22, f } of filteredPositions) {
    const x11 = p11.offsetPx - offsetL0
    const x12 = p12.offsetPx - offsetL0
    const x21 = p21.offsetPx - offsetL1
    const x22 = p22.offsetPx - offsetL1
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)

    // Thin lines get batched by color for efficient drawing
    if (
      l1 <= lineLimit &&
      l2 <= lineLimit &&
      x21 < width + oobLimit &&
      x21 > -oobLimit
    ) {
      const strand = f.get('strand')
      const refName = f.get('refName')
      const mate = f.get('mate')
      const colorKey = colors.getMatchColor(strand, refName, mate?.refName)

      if (!thinLinesByColor.has(colorKey)) {
        thinLinesByColor.set(colorKey, [])
      }
      thinLinesByColor.get(colorKey)!.push({ x11, x21 })
    }
  }

  // Draw thin lines batched by color
  for (const [colorKey, lines] of thinLinesByColor) {
    mainCanvas.strokeStyle = colorKey
    mainCanvas.beginPath()
    if (drawCurves) {
      for (const { x11, x21 } of lines) {
        mainCanvas.moveTo(x11, y1)
        mainCanvas.bezierCurveTo(x11, mid, x21, mid, x21, y2)
      }
    } else {
      for (const { x11, x21 } of lines) {
        mainCanvas.moveTo(x11, y1)
        mainCanvas.lineTo(x21, y2)
      }
    }
    mainCanvas.stroke()
  }

  // Draw thick features (with CIGAR if available)
  mainCanvas.fillStyle = colors.defaultColor
  for (const { p11, p12, p21, p22, f, cigar } of filteredPositions) {
    const strand = f.get('strand')
    const refName = f.get('refName')
    const mate = f.get('mate')
    const mateRefName = mate?.refName

    const x11 = p11.offsetPx - offsetL0
    const x12 = p12.offsetPx - offsetL0
    const x21 = p21.offsetPx - offsetL1
    const x22 = p22.offsetPx - offsetL1
    const l1 = Math.abs(x12 - x11)
    const l2 = Math.abs(x22 - x21)

    // Skip thin features (already drawn above)
    if (l1 <= lineLimit && l2 <= lineLimit) {
      continue
    }

    const minX = Math.min(x21, x22)
    const maxX = Math.max(x21, x22)
    if (!doesIntersect2(minX, maxX, -oobLimit, width + oobLimit)) {
      continue
    }

    const k1 = strand === -1 ? x12 : x11
    const k2 = strand === -1 ? x11 : x12
    const rev1 = k1 < k2 ? 1 : -1
    const rev2 = (x21 < x22 ? 1 : -1) * strand

    if (cigar.length && drawCIGAR) {
      let cx1 = k1
      let cx2 = strand === -1 ? x22 : x21
      let continuingFlag = false
      let px1 = 0
      let px2 = 0

      for (let j = 0; j < cigar.length; j += 2) {
        const len = +cigar[j]!
        const op = cigar[j + 1]!

        if (!continuingFlag) {
          px1 = cx1
          px2 = cx2
        }

        const d1 = len * bpPerPxInv0
        ;[cx1, cx2] = processCigarOp(
          op,
          len,
          cx1,
          cx2,
          rev1,
          rev2,
          bpPerPxInv0,
          bpPerPxInv1,
        )

        // Skip if entirely out of view
        if (
          Math.max(px1, px2, cx1, cx2) < 0 ||
          Math.min(px1, px2, cx1, cx2) > width
        ) {
          continue
        }

        const isNotLast = j < cigar.length - 2
        if (
          Math.abs(cx1 - px1) <= 1 &&
          Math.abs(cx2 - px2) <= 1 &&
          isNotLast
        ) {
          continuingFlag = true
          continue
        }

        const letter = (continuingFlag && d1 > 1) ? op : 'M'
        continuingFlag = false

        // Use match color for non-indel operations, CIGAR colors for indels
        const isIndel = letter === 'I' || letter === 'D' || letter === 'N'
        if (useCustomColor && !isIndel) {
          mainCanvas.fillStyle = colors.getMatchColor(
            strand,
            refName,
            mateRefName,
          )
        } else {
          mainCanvas.fillStyle = colors.getCigarColor(letter as CigarOp)
        }

        const isMatch = letter === 'M' || letter === '=' || letter === 'X'
        if (drawCIGARMatchesOnly && !isMatch) {
          continue
        }

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
      // No CIGAR - draw simple shape
      if (useCustomColor) {
        mainCanvas.fillStyle = colors.getMatchColor(strand, refName, mateRefName)
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

  const unitMultiplier = Math.floor(MAX_COLOR_RANGE / filteredPositions.length)
  for (let i = 0; i < filteredPositions.length; i++) {
    const feature = filteredPositions[i]!
    const idx = i * unitMultiplier + 1
    ctx2.fillStyle = makeColor(idx)

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
      viewWidth: width,
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
