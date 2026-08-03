import { alpha, getContrastText } from '@jbrowse/core/ui/palette'

import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

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

export function getColorBaseMap(palette: JBrowsePalette) {
  const { bases } = palette
  return {
    a: bases.A.main,
    c: bases.C.main,
    g: bases.G.main,
    t: bases.T.main,
    n: bases.N.main,
  }
}

export function getMafColorPalette(palette: JBrowsePalette): MafColorPalette {
  return {
    colorForBase: getColorBaseMap(palette),
    matchColor: palette.action.disabledBackground,
    gapColor: palette.deletion,
    mismatchOffColor: palette.mutedSnpBase,
    unknownBaseColor: palette.text.primary,
    insertionColor: palette.insertion,
    bridgeLineColor: palette.text.secondary,
    missingDataColor: palette.missingData,
  }
}

/**
 * The theme's CDS reading-frame colors as plain CSS strings, indexed the same
 * as `palette.framesCDS` (slot 0 unused; slots 1..3 are the `+`-strand
 * frames, 4..6 the mirrored `−`-strand frames). The annotation overlay indexes
 * this with the `frameIndex` from `computeVisibleAnnotations` via `.at()`.
 */
export function getFrameColors(
  palette: JBrowsePalette,
): (string | undefined)[] {
  return palette.framesCDS.map(c => c?.main)
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
export function getCodonColors(palette: JBrowsePalette) {
  const dark = palette.mode === 'dark'
  return {
    fill: {
      same: undefined,
      syn: alpha(palette.codonSynonymous, dark ? 0.4 : 0.18),
      nonsyn: alpha(palette.codonNonsynonymous, dark ? 0.68 : 0.55),
      stop: alpha(palette.codonStop, dark ? 0.72 : 0.6),
    },
    text: palette.text.primary,
  }
}

export function getContrastBaseMap(palette: JBrowsePalette) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(palette)).map(([key, value]) => [
      key,
      getContrastText(value),
    ]),
  )
}
