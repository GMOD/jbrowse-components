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
