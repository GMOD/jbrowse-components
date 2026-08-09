import {
  TRIANGLE_H as INDICATOR_TRIANGLE_H,
  TRIANGLE_HW as INDICATOR_TRIANGLE_HW,
} from './indicatorTriangle.generated.ts'
import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
} from './insertionLabel.generated.ts'
import { insertionBarWidthPx } from './insertionWidth.generated.ts'

// The insertion thresholds are insertion.slang's, generated in by
// `pnpm gen:shaders` — re-exported here because this module is the vocabulary
// every consumer imports (plugin-alignments, plugin-maf, plugin-variants).
// INSERTION_SERIF_MIN_PX_PER_BP is the zoom below which a small insertion's
// serif caps are dropped; the others gate which of the three markers is drawn.
export {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
}
// Min px-per-bp before per-base text (mismatch letters, small-insertion `(N)`
// labels, clip summaries) is drawn. Shared by plugin-alignments and plugin-maf
// so the two displays reveal these labels at the same zoom.
export const MIN_PX_PER_BP_FOR_TEXT = 6.5

export const MISMATCH_COLOR = '#f00'
const DELETION_COLOR = '#888'
export const INSERTION_COLOR = '#c000c0'
const BASE_A_COLOR = '#00bf00'
const BASE_C_COLOR = '#4747ff'
const BASE_G_COLOR = '#d5bb04'
const BASE_T_COLOR = '#f00'
// N and other non-A/C/G/T bases: muted brown, matching the theme's
// `bases.N` (MUI brown). Distinct from the grey coverage histogram so N
// segments stay visible. This is the theme-agnostic fallback for worker code.
const BASE_N_COLOR = '#795548'

export interface CigarOpDrawColors {
  mismatch: string
  deletion: string
  insertion: string
  baseA: string
  baseC: string
  baseG: string
  baseT: string
  baseN: string
}

export const DEFAULT_CIGAR_OP_DRAW_COLORS: CigarOpDrawColors = {
  mismatch: MISMATCH_COLOR,
  deletion: DELETION_COLOR,
  insertion: INSERTION_COLOR,
  baseA: BASE_A_COLOR,
  baseC: BASE_C_COLOR,
  baseG: BASE_G_COLOR,
  baseT: BASE_T_COLOR,
  baseN: BASE_N_COLOR,
}

export function computeLabelFontSize(h: number) {
  return Math.max(8, Math.min(h, 10))
}

// A size label (deletion length / large-insertion count) reaches full opacity
// once its feature is LABEL_FADE_HI_RATIO times as wide as the space the label
// needs, and fades linearly to nothing as the feature narrows to exactly that
// space. This replaces the old hard appear/disappear cutoff with a smooth fade
// as you zoom out — important when many large indels sit back-to-back (e.g.
// inter-species comparisons), where a hard cutoff makes every label flicker
// on/off at once.
export const LABEL_FADE_HI_RATIO = 2

// Below this opacity a label isn't worth drawing (invisible and sub-pixel), so
// callers drop it entirely.
export const MIN_LABEL_OPACITY = 0.05

// GLSL/WGSL smoothstep, matching the Canvas2D fades elsewhere in the plugin.
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// Opacity in [0,1] for a size label given how many pixels its feature spans on
// screen (`availPx`) and the pixel width it needs to be legible (`neededPx`). 0
// at/below `neededPx` (drop the label), ramping to 1 at LABEL_FADE_HI_RATIO ×
// `neededPx`.
export function labelFadeOpacity(availPx: number, neededPx: number) {
  return smoothstep(neededPx, neededPx * LABEL_FADE_HI_RATIO, availPx)
}

// Width in CSS px of the GPU count-label box, for the count drawn into it.
//
// This IS insertion.slang's `textWidth()`, transliterated from slangc's WGSL by
// `pnpm gen:shaders`. It used to be a hand-mirrored copy of the digit-count
// branching over two constants exported from the shader, which is the twin
// adr-051 is about: the box is sized on the GPU and the text is measured here,
// so the two disagreeing means digits spilling out of their background.
export { textWidth as textWidthForNumber } from './insertionWidth.generated.ts'

export type InsertionType = 'large' | 'long' | 'small'

export function getInsertionType(
  length: number,
  pxPerBp: number,
): InsertionType {
  if (length >= LONG_INSERTION_MIN_LENGTH) {
    return length * pxPerBp >= LONG_INSERTION_TEXT_THRESHOLD_PX
      ? 'large'
      : 'long'
  }
  return 'small'
}

// Single source of truth for an insertion marker's width, shared by the GPU
// shader, the Canvas2D/SVG renderer, hit-testing (both alignments and MAF), and
// SNP-letter shadowing. The rule itself is `insertion.slang`'s — generated in
// via its `//! js-export-out` (adr-051), which is what lets a package that
// can't depend on plugin-alignments still run the shader's own arithmetic.
// This wrapper exists only for the default: `featureHeight` falls back to
// MIN_HEIGHT_FOR_TEXT so width-only callers (hit-testing) that don't track row
// height get the labelled width.
//
// `featureHeight` is the marker's drawn pixel height. A 'large' insertion only
// earns the wide count-label box when the row is tall enough to actually draw
// the count (>= MIN_HEIGHT_FOR_TEXT); in compact/super-compact pileups it shrinks
// to the same noticeable bar a 'long' insertion uses, instead of a wide empty
// box.
export function insertionBarWidth(
  len: number,
  pxPerBp: number,
  featureHeight = MIN_HEIGHT_FOR_TEXT,
) {
  return insertionBarWidthPx(len, pxPerBp, featureHeight)
}

// Shared tooltip body for an insertion, used by both plugin-alignments and
// plugin-maf so the phrasing stays identical. Callers append their own location
// suffix ("at <pos>" / a Location line).
export function formatInsertionLabel(length: number, sequence?: string) {
  return sequence && sequence.length <= 20
    ? `Insertion (${length}bp): ${sequence}`
    : `Insertion (${length}bp)`
}

// Draw one insertion marker centered on `xCenter`: a box whose width follows
// insertionBarWidth (1px small / short bar long / number-label-width large) plus
// serif caps on small insertions when zoomed in. The box width is gated on
// `height` (the marker's pixel height) so a 'large' insertion in a row too short
// to fit its count label shrinks to the narrow bar instead of an empty wide box.
// The caller sets `ctx.fillStyle` (including any frequency alpha) and draws the
// count text. Shared by plugin-alignments (Canvas2D/SVG export) and plugin-maf
// (insertion overlay + export) so the marker geometry can't drift between the
// two displays.
export function drawInsertionMarker(
  ctx: DrawCtx,
  xCenter: number,
  y: number,
  height: number,
  length: number,
  pxPerBp: number,
) {
  const w = insertionBarWidth(length, pxPerBp, height)
  ctx.fillRect(xCenter - w / 2, y, w, height)
  const isLong = length >= LONG_INSERTION_MIN_LENGTH
  if (!isLong && pxPerBp >= INSERTION_SERIF_MIN_PX_PER_BP) {
    ctx.beginPath()
    ctx.moveTo(xCenter - 2, y)
    ctx.lineTo(xCenter + 2, y)
    ctx.lineTo(xCenter, y + 2)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(xCenter - 2, y + height - 1)
    ctx.lineTo(xCenter + 2, y + height - 1)
    ctx.lineTo(xCenter, y + height - 3)
    ctx.closePath()
    ctx.fill()
  }
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
  return ch !== undefined && ':*+-'.includes(ch)
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

// Generated from `alignmentsUniforms.slang`'s TRIANGLE_HW / TRIANGLE_H by
// `pnpm gen:shaders` (its `//! consts-out` directive), so the Canvas2D triangle
// below, the hit test, and the two GPU passes that draw and hang off it are all
// one number.
export { INDICATOR_TRIANGLE_HW, INDICATOR_TRIANGLE_H }

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
