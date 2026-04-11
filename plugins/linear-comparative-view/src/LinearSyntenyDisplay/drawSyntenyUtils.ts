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

export const lineLimit = 3

export const oobLimit = 1600

// Simple hash function to generate consistent colors for query names
function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

// Generate a color from a query name using the category10 color palette
export function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}

// Default CIGAR operation colors
export const defaultCigarColors = {
  I: '#ff0a',
  N: '#0a0a',
  D: '#00fa',
  X: 'brown',
  M: '#f00a',
  '=': '#f00a',
}

// Strand-specific CIGAR operation colors (purple deletion instead of blue)
export const strandCigarColors = {
  I: '#ff0a',
  N: '#a020f0',
  D: '#a020f0',
  X: 'brown',
  M: '#f00a',
  '=': '#f00a',
}

// SyRI structural type colors (plotsr-compatible)
export const syriColors = {
  SYN: '#CCCCCC',
  INV: '#FFA500',
  TRANS: '#6495ED',
  DUP: '#00CED1',
}

// Color scheme configuration
export const colorSchemes = {
  default: {
    cigarColors: defaultCigarColors,
  },
  strand: {
    posColor: 'red',
    negColor: 'blue',
    cigarColors: strandCigarColors,
  },
  query: {
    cigarColors: defaultCigarColors,
  },
  syri: {
    cigarColors: defaultCigarColors,
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
