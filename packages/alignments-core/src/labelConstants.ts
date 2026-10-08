import { measuredFont } from '@jbrowse/core/util'

import {
  TRIANGLE_H as INDICATOR_TRIANGLE_H,
  TRIANGLE_HW as INDICATOR_TRIANGLE_HW,
} from './indicatorTriangle.generated.ts'
import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  SERIF_H_PX,
  SERIF_HALF_W_PX,
} from './insertionLabel.generated.ts'
import { insertionSizeAlpha } from './insertionSizeAlpha.generated.ts'
import {
  insertionBarWidthPx,
  insertionSerifsDraw,
} from './insertionWidth.generated.ts'

// The insertion thresholds are render-core's insertionGlyph.slang, generated
// in by `pnpm gen:shaders` and re-exported as the vocabulary every consumer
// imports.
export {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  SERIF_H_PX,
  SERIF_HALF_W_PX,
  insertionSizeAlpha,
}
// Min px-per-bp before per-base text (mismatch letters, small-insertion `(N)`
// labels, clip summaries) is drawn. Shared by plugin-alignments and plugin-maf
// so the two displays reveal these labels at the same zoom.
export const MIN_PX_PER_BP_FOR_TEXT = 6.5

export const MISMATCH_COLOR = '#f00'
export const INSERTION_COLOR = '#c000c0'
const BASE_A_COLOR = '#00bf00'
const BASE_C_COLOR = '#4747ff'
const BASE_G_COLOR = '#d5bb04'
const BASE_T_COLOR = '#f00'
// N and other non-A/C/G/T bases: muted brown, matching the theme's
// `bases.N` (MUI brown). Distinct from the grey coverage histogram so N
// segments stay visible. This is the theme-agnostic fallback for worker code.
const BASE_N_COLOR = '#795548'

// The palette a SNP-coverage segment draw reads, and the whole of it: the
// segments are per-base, so `colorType` resolves to one of these five and to
// nothing else. This was a `CigarOpDrawColors` carrying `mismatch`, `deletion`
// and `insertion` as well — a shape neither consumer could fill honestly, so
// `buildCigarOpDrawColors` wrote `''` into two of them and computed a deletion
// color for a draw that has no deletions, and MAF spread the defaults in
// purely to satisfy the type.
export interface SnpBaseColors {
  baseA: string
  baseC: string
  baseG: string
  baseT: string
  baseN: string
}

export const DEFAULT_SNP_BASE_COLORS: SnpBaseColors = {
  baseA: BASE_A_COLOR,
  baseC: BASE_C_COLOR,
  baseG: BASE_G_COLOR,
  baseT: BASE_T_COLOR,
  baseN: BASE_N_COLOR,
}

// The font a pileup's size labels draw in, for a row `h` px tall: 10px down to
// a floor of 8, below which the digits stop being digits. It carries its own
// measurement (`measuredFont`) because the size is decided here, where labels
// are placed, and the family was spelled only in `drawAlignmentLabels` — so the
// fit tests were measuring Helvetica on the strength of a `sans-serif` they
// could not see. That is the arrangement that put plugin-maf's count outside its
// own run.
export function labelFont(h: number) {
  return measuredFont(Math.max(8, Math.min(h, 10)), 'sans-serif', 'bold')
}

// A deletion's length label rides the fade below: it appears once the grey rect
// is LABEL_FADE_LO_RATIO times as wide as the digits need, and reaches full
// opacity at LABEL_FADE_HI_RATIO. That fade is what stops a wall of back-to-back
// indels (inter-species comparisons) from flickering every label on and off at
// one zoom, and the rect under it grows continuously, so there is a real
// dissolve to smooth.
//
// LO is the slack the label has always had over an exact fit — it used to be the
// smoothstep inverse of a 5% cutoff, and is kept to the digit so that flooring
// the curve retunes opacities without moving which labels exist.
export const LABEL_FADE_LO_RATIO = 1.135
export const LABEL_FADE_HI_RATIO = 2

// The fade bottoms out here rather than at 0. A fade only reads as a fade while
// it is moving: a still frame — or an SVG export, which bakes this opacity into
// the fill — holds whatever value the zoom happened to land on, and 5% digits
// there are not a fading label, they are broken text.
export const LABEL_FADE_FLOOR = 0.5

// Below this a SNP letter isn't worth a fillText. This is the quality fade's
// floor alone — not the size labels', which is LABEL_FADE_FLOOR above. The
// quality ramp is a property of the base rather than of the zoom, so it rightly
// goes all the way to nothing, and raising this to make a faint label legible
// deletes letters instead: `qualityFade` is qual/50, so a floor of 0.5 drops
// every base under Phred 25.
export const MIN_QUALITY_LETTER_OPACITY = 0.05

// GLSL/WGSL smoothstep, matching the Canvas2D fades elsewhere in the plugin.
function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// The narrowest a feature can be on screen and still carry a size label.
//
// This is the fade's own low edge, and it exists as its own function so a caller
// can decide it has nothing to draw WITHOUT walking its features.
// `labelFadeOpacity` answers per feature, which on a deep pileup is hundreds of
// thousands of calls per frame to emit nothing; this answers the same question
// once, in the units a feature's own bp length can be tested against.
export function minAvailPxForLabel(neededPx: number) {
  return neededPx * LABEL_FADE_LO_RATIO
}

// Opacity for a size label, given how many pixels its feature spans on screen
// (`availPx`) and the pixel width the label needs (`neededPx`). 0 below
// `minAvailPxForLabel` — drop the label — then LABEL_FADE_FLOOR ramping to
// 1 at LABEL_FADE_HI_RATIO × `neededPx`.
export function labelFadeOpacity(availPx: number, neededPx: number) {
  if (availPx < minAvailPxForLabel(neededPx)) {
    return 0
  }
  return (
    LABEL_FADE_FLOOR +
    (1 - LABEL_FADE_FLOOR) *
      smoothstep(neededPx, neededPx * LABEL_FADE_HI_RATIO, availPx)
  )
}

// Width in CSS px of the GPU count-label box, for the count drawn into it.
//
// This IS insertionGlyph.slang's `textWidth()`, transliterated from slangc's WGSL by
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
// SNP-letter shadowing. The rule itself is `insertionGlyph.slang`'s — generated in
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

// An insertion marker's serif caps, without the bar under them: two wedges
// `SERIF_HALF_W_PX` / `SERIF_H_PX` from insertionGlyph.slang, each base on its
// row edge, so the mark reads as a symmetric I-beam on every backend. A long
// insertion has no caps, and neither has any insertion zoomed out past
// `INSERTION_SERIF_MIN_PX_PER_BP`.
export function drawInsertionSerifs(
  ctx: DrawCtx,
  xCenter: number,
  y: number,
  height: number,
  length: number,
  pxPerBp: number,
) {
  if (insertionSerifsWidthPx(length, pxPerBp) > 0) {
    drawSerif(ctx, xCenter, y, y + SERIF_H_PX)
    drawSerif(ctx, xCenter, y + height, y + height - SERIF_H_PX)
  }
}

/** How wide the caps reach about the bar's centre, 0 where none draw. */
export function insertionSerifsWidthPx(length: number, pxPerBp: number) {
  return insertionSerifsDraw(length, pxPerBp) ? 2 * SERIF_HALF_W_PX : 0
}

// One serif cap: a wedge `SERIF_HALF_W_PX` either side of `xCenter` at `baseY`,
// tapering to a point at `apexY`. Mirrors the serif quads of insertion.slang and insertionMark.slang.
function drawSerif(
  ctx: DrawCtx,
  xCenter: number,
  baseY: number,
  apexY: number,
) {
  ctx.beginPath()
  ctx.moveTo(xCenter - SERIF_HALF_W_PX, baseY)
  ctx.lineTo(xCenter + SERIF_HALF_W_PX, baseY)
  ctx.lineTo(xCenter, apexY)
  ctx.closePath()
  ctx.fill()
}

// The context members the caps touch — a structural subset both `Ctx2D` and
// render-core's `MarkContext2D` satisfy, so an insertion painter can hand its
// context straight through.
interface DrawCtx {
  fillStyle: string | CanvasGradient | CanvasPattern
  fillRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  closePath(): void
  fill(): void
}

// Generated from `alignmentsUniforms.slang`'s TRIANGLE_HW / TRIANGLE_H by
// `pnpm gen:shaders` (its `//! consts-out` directive), so the Canvas2D triangle
// below, the hit test, and the two GPU passes that draw and hang off it are all
// one number.
export { INDICATOR_TRIANGLE_HW, INDICATOR_TRIANGLE_H }

/**
 * Draw a single downward-pointing indicator triangle on a Canvas2D context.
 */
export function drawIndicatorTriangle(
  ctx: Pick<DrawCtx, 'beginPath' | 'moveTo' | 'lineTo' | 'closePath' | 'fill'>,
  cx: number,
) {
  ctx.beginPath()
  ctx.moveTo(cx - INDICATOR_TRIANGLE_HW, 0)
  ctx.lineTo(cx + INDICATOR_TRIANGLE_HW, 0)
  ctx.lineTo(cx, INDICATOR_TRIANGLE_H)
  ctx.closePath()
  ctx.fill()
}
