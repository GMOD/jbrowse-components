import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

export const lineLimit = 3

export const oobLimit = 1600

// Simple hash function to generate consistent colors for query names
function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
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
}

export type ColorScheme = keyof typeof colorSchemes

export function applyAlpha(color: string, alpha: number) {
  // Skip colord processing if alpha is 1 (optimization)
  if (alpha === 1) {
    return color
  }
  return colord(color).alpha(alpha).toHex()
}
