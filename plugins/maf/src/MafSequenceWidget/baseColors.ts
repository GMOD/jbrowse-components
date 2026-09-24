import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

type BaseKey = 'A' | 'C' | 'G' | 'T'

function getBaseKey(base: string): BaseKey | undefined {
  switch (base.toUpperCase()) {
    case 'A':
      return 'A'
    case 'C':
      return 'C'
    case 'G':
      return 'G'
    case 'T':
    case 'U':
      return 'T'
    default:
      return undefined
  }
}

export function getBaseColor(base: string, palette: JBrowsePalette): string {
  const key = getBaseKey(base)
  return key ? palette.bases[key].main : palette.grey[500]
}

export function getContrastText(base: string, palette: JBrowsePalette): string {
  const key = getBaseKey(base)
  return key ? palette.bases[key].contrastText : palette.common.white
}

/** Glyph color for a sequence cell: gaps/missing-data grays, otherwise the
 *  contrast color over a tinted background or the base color on plain. */
export function getTextColor(
  base: string,
  colorBackground: boolean,
  palette: JBrowsePalette,
): string {
  return base === '-'
    ? palette.grey[400]
    : base === '.'
      ? palette.grey[500]
      : colorBackground
        ? getContrastText(base, palette)
        : getBaseColor(base, palette)
}
