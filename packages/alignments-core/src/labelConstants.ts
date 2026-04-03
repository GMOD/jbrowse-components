import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from './cigarConstants.ts'

export const LONG_INSERTION_MIN_LENGTH = 10
export const LONG_INSERTION_TEXT_THRESHOLD_PX = 15
export const MIN_HEIGHT_FOR_TEXT = 5

export const MISMATCH_COLOR = '#f00'
export const DELETION_COLOR = '#888'
export const INSERTION_COLOR = '#c000c0'
export const BASE_A_COLOR = '#00bf00'
export const BASE_C_COLOR = '#4747ff'
export const BASE_G_COLOR = '#d5bb04'
export const BASE_T_COLOR = '#f00'

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

function drawSerifs(ctx: DrawCtx, px: number, y: number, h: number, triW: number) {
  ctx.beginPath()
  ctx.moveTo(px - triW, y)
  ctx.lineTo(px + triW, y)
  ctx.lineTo(px, y + triW)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px - triW, y + h)
  ctx.lineTo(px + triW, y + h)
  ctx.lineTo(px, y + h - triW)
  ctx.closePath()
  ctx.fill()
}

export function drawDeletion(
  ctx: DrawCtx,
  px: number,
  y: number,
  pw: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(px, y, Math.max(pw, 1), h)
}

export function drawInsertion(
  ctx: DrawCtx,
  px: number,
  y: number,
  h: number,
  len: number,
  pxPerBp: number,
  color: string,
) {
  ctx.fillStyle = color
  const isLarge =
    len >= LONG_INSERTION_MIN_LENGTH &&
    len * pxPerBp >= LONG_INSERTION_TEXT_THRESHOLD_PX

  if (isLarge) {
    const boxW = textWidthForNumber(len)
    ctx.fillRect(px - boxW / 2, y, boxW, h)
    ctx.fillStyle = 'white'
    ctx.font = `${Math.min(9, h - 2)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${len}`, px, y + h / 2)
  } else {
    ctx.fillRect(px - 0.5, y, 1, h)
    if (h >= 6) {
      drawSerifs(ctx, px, y, h, Math.min(3, h / 3))
    }
  }
}

// CS tag parsing helpers

export function isDigit(ch: string) {
  return ch >= '0' && ch <= '9'
}

export function isCsOpChar(ch: string | undefined) {
  return ch === ':' || ch === '*' || ch === '+' || ch === '-'
}

export function parseCsSeqLen(cs: string, start: number) {
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

// Shared CIGAR/CS op drawing

export function drawCigarOps(
  ctx: DrawCtx,
  cigar: number[],
  x: number,
  y: number,
  w: number,
  h: number,
  bpLen: number,
  colors: CigarOpDrawColors,
) {
  const pxPerBp = w / bpLen
  let refPos = 0

  for (const packed of cigar) {
    const len = packed >>> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      refPos += len
    } else if (op === CIGAR_X) {
      const pw = len * pxPerBp
      if (pw >= 0.1) {
        ctx.fillStyle = colors.mismatch
        ctx.fillRect(x + refPos * pxPerBp, y, Math.max(pw, 1), h)
      }
      refPos += len
    } else if (op === CIGAR_D || op === CIGAR_N) {
      const pw = len * pxPerBp
      if (pw >= 0.1) {
        drawDeletion(ctx, x + refPos * pxPerBp, y, pw, h, colors.deletion)
      }
      refPos += len
    } else if (op === CIGAR_I) {
      drawInsertion(ctx, x + refPos * pxPerBp, y, h, len, pxPerBp, colors.insertion)
    }
  }
}

export function drawCsOps(
  ctx: DrawCtx,
  cs: string,
  x: number,
  y: number,
  w: number,
  h: number,
  bpLen: number,
  colors: CigarOpDrawColors,
) {
  const pxPerBp = w / bpLen
  let refPos = 0
  let i = 0
  const baseColors: Record<string, string> = {
    a: colors.baseA,
    c: colors.baseC,
    g: colors.baseG,
    t: colors.baseT,
  }

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
      const queryBase = cs[i + 2] ?? ''
      ctx.fillStyle = baseColors[queryBase.toLowerCase()] ?? colors.mismatch
      ctx.fillRect(x + refPos * pxPerBp, y, Math.max(pxPerBp, 1), h)
      i += 3
      refPos += 1
    } else if (ch === '-') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        const pw = len * pxPerBp
        if (pw >= 0.1) {
          drawDeletion(ctx, x + refPos * pxPerBp, y, pw, h, colors.deletion)
        }
        refPos += len
      }
    } else if (ch === '+') {
      i++
      const len = parseCsSeqLen(cs, i)
      i += len
      if (len > 0) {
        drawInsertion(ctx, x + refPos * pxPerBp, y, h, len, pxPerBp, colors.insertion)
      }
    } else {
      i++
    }
  }
}
