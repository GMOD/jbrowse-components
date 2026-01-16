import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

export const MAX_COLOR_RANGE = 255 * 255 * 255 // max color range

export const lineLimit = 3

export const oobLimit = 1600

export function makeColor(idx: number) {
  const r = Math.floor(idx / (255 * 255)) % 255
  const g = Math.floor(idx / 255) % 255
  const b = idx % 255
  return `rgb(${r},${g},${b})`
}

export function getId(
  r: number,
  g: number,
  b: number,
  unitMultiplier: number,
) {
  return Math.floor((r * 255 * 255 + g * 255 + b - 1) / unitMultiplier)
}

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
  I: '#ff03',
  N: '#0a03',
  D: '#00f3',
  X: 'brown',
  M: '#f003',
  '=': '#f003',
}

// Strand-specific CIGAR operation colors (purple deletion instead of blue)
export const strandCigarColors = {
  I: '#ff03',
  N: '#a020f0', // Purple for deletion
  D: '#a020f0', // Purple for deletion
  X: 'brown',
  M: '#f003',
  '=': '#f003',
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
