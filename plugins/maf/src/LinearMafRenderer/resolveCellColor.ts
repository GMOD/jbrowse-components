/**
 * Single source of truth for "what color should this MAF cell be".
 * Shared by the GPU instance-buffer encoder (`buildInstanceBuffer`) and
 * the Canvas2D fallback (`rendering/bases.ts`) so both paths produce
 * identical pixels.
 *
 * Returns `undefined` for cells that should not be drawn as a base rect
 * (reference insertions — those are rendered by the separate insertion
 * pass).
 */

const DASH = '-'.charCodeAt(0)
const SPACE = ' '.charCodeAt(0)

const MATCH_GREY = 'lightgrey'
const GAP_DARK = '#1e1e1e'
const MISMATCH_OFF_ORANGE = 'orange'
const SHOW_ALL_NO_MISMATCH_BLUE = 'lightblue'
const UNKNOWN_BASE_FALLBACK = 'black'

export interface MafCellColorConfig {
  colorForBase: Record<string, string>
  showAllLetters: boolean
  mismatchRendering: boolean
}

export function resolveCellColor(
  refByte: number,
  alnByte: number,
  cfg: MafCellColorConfig,
): string | undefined {
  if (refByte === DASH) {
    return undefined // reference insertion — drawn separately
  }
  if (alnByte === DASH || alnByte === SPACE) {
    return GAP_DARK
  }
  const isMatch = (refByte | 0x20) === (alnByte | 0x20)
  if (isMatch && !cfg.showAllLetters) {
    return MATCH_GREY
  }
  if (isMatch && !cfg.mismatchRendering) {
    return SHOW_ALL_NO_MISMATCH_BLUE
  }
  if (!isMatch && !cfg.mismatchRendering) {
    return MISMATCH_OFF_ORANGE
  }
  const base = String.fromCharCode(alnByte | 0x20)
  return cfg.colorForBase[base] ?? UNKNOWN_BASE_FALLBACK
}
