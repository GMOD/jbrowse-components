export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15
export const MIN_HEIGHT_FOR_TEXT = 5

export const MISMATCH_COLOR = '#f00'
const DELETION_COLOR = '#888'
const INSERTION_COLOR = '#c000c0'
const BASE_A_COLOR = '#00bf00'
const BASE_C_COLOR = '#4747ff'
const BASE_G_COLOR = '#d5bb04'
const BASE_T_COLOR = '#f00'

export interface CigarOpDrawColors {
  mismatch: string
  deletion: string
  insertion: string
  baseA: string
  baseC: string
  baseG: string
  baseT: string
}

export const DEFAULT_CIGAR_OP_DRAW_COLORS: CigarOpDrawColors = {
  mismatch: MISMATCH_COLOR,
  deletion: DELETION_COLOR,
  insertion: INSERTION_COLOR,
  baseA: BASE_A_COLOR,
  baseC: BASE_C_COLOR,
  baseG: BASE_G_COLOR,
  baseT: BASE_T_COLOR,
}

export function computeLabelFontSize(h: number) {
  return Math.max(8, Math.min(h, 10))
}

// SYNC: mirrors textWidthForNumber() in GLSL/WGSL cigarShaders.ts
// charWidth=6px per digit + padding=10px
export function textWidthForNumber(num: number) {
  const charWidth = 6
  const padding = 10
  if (num < 10) {
    return charWidth + padding
  }
  if (num < 100) {
    return charWidth * 2 + padding
  }
  if (num < 1000) {
    return charWidth * 3 + padding
  }
  if (num < 10000) {
    return charWidth * 4 + padding
  }
  return charWidth * 5 + padding
}

interface DrawCtx {
  fillStyle: string | CanvasGradient | CanvasPattern
  font: string
  textAlign: string
  textBaseline: string
  fillRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number, maxWidth?: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
}

// CS tag parsing helpers

export function isDigit(ch: string) {
  return ch >= '0' && ch <= '9'
}

export function isCsOpChar(ch: string | undefined) {
  return ch === ':' || ch === '*' || ch === '+' || ch === '-'
}

function parseCsSeqLen(cs: string, start: number) {
  let i = start
  while (i < cs.length && !isCsOpChar(cs[i])) {
    i++
  }
  return i - start
}

/**
 * Extract substitution mismatches from a CS tag string.
 * Pushes MismatchEntry objects (position + base ASCII code) into the output array.
 * Handles all CS operations: `:N` (match), `*XY` (substitution), `-seq` (deletion), `+seq` (insertion).
 */
export function extractMismatchesFromCs(
  cs: string,
  featureStart: number,
  mismatches: { position: number; base: number; strand: number }[],
) {
  let refPos = 0
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && isDigit(cs[i]!)) {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      // *XY = substitution: X=ref base, Y=query base
      const queryBase = cs[i + 2]
      if (queryBase) {
        mismatches.push({
          position: featureStart + refPos,
          base: queryBase.toUpperCase().charCodeAt(0),
          strand: 0,
        })
      }
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      refPos += len
    } else if (ch === '+') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
    } else {
      i++
    }
  }
}

export interface IndelEntry {
  position: number
  type: 1 | 2 // 1=insertion, 2=deletion
  length: number
}

/**
 * Extract insertion and deletion events from a CS tag string.
 * Pushes IndelEntry objects into the output array.
 */
export function extractIndelsFromCs(
  cs: string,
  featureStart: number,
  indels: IndelEntry[],
) {
  let refPos = 0
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      i++
      let num = 0
      while (i < cs.length && isDigit(cs[i]!)) {
        num = num * 10 + (cs.charCodeAt(i) - 48)
        i++
      }
      refPos += num
    } else if (ch === '*') {
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const len = parseCsSeqLen(cs, i)
      indels.push({ position: featureStart + refPos, type: 2, length: len })
      i += len
      refPos += len
    } else if (ch === '+') {
      i++
      const len = parseCsSeqLen(cs, i)
      indels.push({ position: featureStart + refPos, type: 1, length: len })
      i += len
    } else {
      i++
    }
  }
}

export const INDICATOR_TRIANGLE_HW = 3.5
export const INDICATOR_TRIANGLE_H = 4.5

/**
 * Draw a single downward-pointing indicator triangle on a Canvas2D context.
 */
export function drawIndicatorTriangle(ctx: DrawCtx, cx: number) {
  ctx.beginPath()
  ctx.moveTo(cx - INDICATOR_TRIANGLE_HW, 0)
  ctx.lineTo(cx + INDICATOR_TRIANGLE_HW, 0)
  ctx.lineTo(cx, INDICATOR_TRIANGLE_H)
  ctx.closePath()
  ctx.fill()
}
