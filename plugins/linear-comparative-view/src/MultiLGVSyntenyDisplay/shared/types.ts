import type { CigarOpDrawColors } from '@jbrowse/alignments-core'

export const LABEL_WIDTH = 120
export const LABEL_FONT_MAX = 12

export const BG_COLOR_HEX = '#ededed'
export const BG_COLOR_GL = 0.93

export function truncateGenomeName(name: string) {
  return name.length > 15 ? `${name.slice(0, 12)}...` : name
}

export type BpToPxFn = (refName: string, coord: number) => number | undefined

export type SyntenyColors = CigarOpDrawColors
