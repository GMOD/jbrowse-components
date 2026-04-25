import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_X,
} from '@jbrowse/alignments-core'
import { category10 } from '@jbrowse/core/ui/colors'
import {
  alpha as setAlpha,
  formatHEXA,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import type { SyriType } from '@jbrowse/plugin-comparative-adapters'

export const lineLimit = 3

export const oobLimit = 1600

export function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

export function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}

// CIGAR operation colors. Kept opaque — every consumer either runs them
// through applyAlpha() (model.ts) or packs them via cssColorToABGR() and
// applies u.alpha in the shader / `a * alpha` in Canvas2D. A non-opaque
// literal here would multiply with that uniform and render fainter than
// intended.
export const defaultCigarColors = {
  I: '#ff0',
  N: '#0a0',
  D: '#00f',
  X: 'brown',
  M: '#f00',
  '=': '#f00',
}

// Strand-specific CIGAR operation colors (purple indels instead of blue/green)
export const strandCigarColors = {
  I: '#ff0',
  N: '#a020f0',
  D: '#a020f0',
  X: 'brown',
  M: '#f00',
  '=': '#f00',
}

// SyRI structural type colors matching plotsr defaults exactly
export const syriColors = {
  SYN: '#DEDEDE',
  INV: '#FFA500',
  TRANS: '#9ACD32',
  DUP: '#00BBFF',
} satisfies Record<SyriType, string>

// Color scheme configuration. `query` and `syri` reuse the default CIGAR
// palette; only `strand` differs (indels in purple instead of blue/green, plus
// strand-aware feature colors).
export const colorSchemes = {
  default: {
    cigarColors: defaultCigarColors,
  },
  strand: {
    posColor: '#f00',
    negColor: '#00f',
    cigarColors: strandCigarColors,
  },
}

export type ColorScheme = keyof typeof colorSchemes

export const OP_TO_CIGAR_KEY: Record<number, string> = {
  [CIGAR_M]: 'M',
  [CIGAR_I]: 'I',
  [CIGAR_D]: 'D',
  [CIGAR_N]: 'N',
  [CIGAR_EQ]: '=',
  [CIGAR_X]: 'X',
}

export function applyAlpha(color: string, a: number) {
  if (a === 1) {
    return color
  }
  return formatHEXA(setAlpha(parseCssColor(color), a))
}
