import { alpha } from '@mui/material'

import type { Theme } from '@mui/material'

/**
 * Theme-derived color set fed to the MAF cell-color resolver. Centralizing
 * the theme lookup here keeps `resolveCellColor`, the GPU encoder, and the
 * Canvas2D path consistent — and gives users one place to override colors
 * via custom themes (no more hardcoded fallbacks in the renderer).
 */
export interface MafColorPalette {
  colorForBase: Record<string, string>
  matchColor: string
  gapColor: string
  mismatchOffColor: string
  unknownBaseColor: string
  insertionColor: string
  /** Color of the single/double bridge lines drawn for `e`-line rows */
  bridgeLineColor: string
  /** Pale fill for `M`-status (missing-data) bridged rows, à la UCSC */
  missingDataColor: string
}

export function getColorBaseMap(theme: Theme) {
  const { bases } = theme.palette
  return {
    a: bases.A.main,
    c: bases.C.main,
    g: bases.G.main,
    t: bases.T.main,
    n: bases.N.main,
  }
}

export function getMafColorPalette(theme: Theme): MafColorPalette {
  return {
    colorForBase: getColorBaseMap(theme),
    matchColor: theme.palette.action.disabledBackground,
    gapColor: theme.palette.deletion,
    mismatchOffColor: theme.palette.mutedSnpBase,
    unknownBaseColor: theme.palette.text.primary,
    insertionColor: theme.palette.insertion,
    bridgeLineColor: theme.palette.text.secondary,
    missingDataColor: theme.palette.missingData,
  }
}

/**
 * The theme's CDS reading-frame colors as plain CSS strings, indexed the same
 * as `theme.palette.framesCDS` (slot 0 unused; slots 1..3 are the `+`-strand
 * frames, 4..6 the mirrored `−`-strand frames). The annotation overlay indexes
 * this with the `frameIndex` from `computeVisibleAnnotations` via `.at()`.
 */
export function getFrameColors(theme: Theme): (string | undefined)[] {
  return theme.palette.framesCDS.map(c => c?.main)
}

/**
 * Codon-view cell colors: nonsynonymous changes get a clear highlight, silent
 * (synonymous) changes a faint fill, stops the error color, and conserved codons
 * no fill (the cell stays clean). The amino-acid glyph drawn on top uses the
 * primary text color. Theme-derived so it's available headless for SVG export.
 *
 * Dark mode uses higher alphas: a translucent fill composites toward the (dark)
 * track background, so the light-mode synonymous blue at 0.18 nearly vanishes
 * there — the per-mode alphas keep every change category legible on both.
 */
export function getCodonColors(theme: Theme) {
  const dark = theme.palette.mode === 'dark'
  return {
    fill: {
      same: undefined,
      syn: alpha(theme.palette.codonSynonymous, dark ? 0.4 : 0.18),
      nonsyn: alpha(theme.palette.codonNonsynonymous, dark ? 0.68 : 0.55),
      stop: alpha(theme.palette.codonStop, dark ? 0.72 : 0.6),
    },
    text: theme.palette.text.primary,
  }
}

export function getContrastBaseMap(theme: Theme) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(theme)).map(([key, value]) => [
      key,
      theme.palette.getContrastText(value),
    ]),
  )
}
