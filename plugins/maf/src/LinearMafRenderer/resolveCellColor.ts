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

/**
 * Per-cell color decisions are resolved against the theme: matches reuse
 * MUI's `action.disabledBackground` (the canonical "neutral filler" tone),
 * alignment gaps reuse `palette.deletion`, off-mode mismatches reuse
 * `palette.mutedSnpBase`, and unknown bases fall back to `palette.text.primary`.
 * The lightblue used when `showAllLetters && !mismatchRendering` has no theme
 * equivalent, so it stays as the one explicit constant.
 */
const SHOW_ALL_NO_MISMATCH_FALLBACK = 'lightblue'

export interface MafCellColorConfig {
  /** A/C/G/T/N → hex, derived from `theme.palette.bases`. */
  colorForBase: Record<string, string>
  /** Color for ref==aln cells when `showAllLetters` is off. */
  matchColor: string
  /** Color for alignment-gap cells (alnByte === '-' or ' '). */
  gapColor: string
  /** Color when `mismatchRendering` is off for mismatched bases. */
  mismatchOffColor: string
  /** Fallback when the base isn't in `colorForBase`. */
  unknownBaseColor: string
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
    return cfg.gapColor
  }
  const isMatch = (refByte | 0x20) === (alnByte | 0x20)
  if (isMatch && !cfg.showAllLetters) {
    return cfg.matchColor
  }
  if (isMatch && !cfg.mismatchRendering) {
    return SHOW_ALL_NO_MISMATCH_FALLBACK
  }
  if (!isMatch && !cfg.mismatchRendering) {
    return cfg.mismatchOffColor
  }
  const base = String.fromCharCode(alnByte | 0x20)
  return cfg.colorForBase[base] ?? cfg.unknownBaseColor
}
