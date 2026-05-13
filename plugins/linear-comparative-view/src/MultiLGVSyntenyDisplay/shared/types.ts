import type { CigarOpDrawColors } from '@jbrowse/alignments-core'

export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

export const BG_COLOR_HEX = '#ededed'
export const BG_COLOR_GL = 0.93

export const ROW_BG_ALT = '#f8f8f8'
export const ROW_DIVIDER = '#e0e0e0'
export const LABEL_TEXT = '#333'

export function truncateGenomeName(name: string) {
  return name.length > 15 ? `${name.slice(0, 12)}...` : name
}

export type BpToPxFn = (refName: string, coord: number) => number | undefined

export type SyntenyColors = CigarOpDrawColors

export interface SyntenyColorPalette {
  coverageColorRgb: [number, number, number]
  coverageColorHex: string
  baseColorGl: {
    A: [number, number, number]
    C: [number, number, number]
    G: [number, number, number]
    T: [number, number, number]
  }
  syntenyColors: SyntenyColors
}
