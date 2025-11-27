import { category10 } from '@jbrowse/core/ui/colors'
import { colord } from '@jbrowse/core/util/colord'

// Use 256-based encoding for bitwise operations (2^24 = 16777216)
export const MAX_COLOR_RANGE = 256 * 256 * 256

export function makeColor(idx: number) {
  // Bitwise extraction: much faster than division
  const r = (idx >> 16) & 0xff
  const g = (idx >> 8) & 0xff
  const b = idx & 0xff
  return `rgb(${r},${g},${b})`
}

// Simple hash function to generate consistent colors for query names
function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  // Convert to positive using unsigned right shift
  return hash >>> 0
}

// Generate a color from a query name using the category10 color palette
export function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}

// Default CIGAR operation colors indexed by numeric code
// Index: M=0, I=1, D=2, N=3, S=4, H=5, P=6, ==7, X=8
export const defaultCigarColors = [
  '#f003', // M
  '#ff03', // I
  '#00f3', // D
  '#0a03', // N
  '#f003', // S (unused)
  '#f003', // H (unused)
  '#f003', // P (unused)
  '#f003', // =
  'brown', // X
]

// Strand-specific CIGAR operation colors (purple deletion instead of blue)
export const strandCigarColors = [
  '#f003', // M
  '#ff03', // I
  '#a020f0', // D - Purple for deletion
  '#a020f0', // N - Purple for deletion
  '#f003', // S (unused)
  '#f003', // H (unused)
  '#f003', // P (unused)
  '#f003', // =
  'brown', // X
]

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

export function getId(r: number, g: number, b: number, unitMultiplier: number) {
  // Bitwise reconstruction matching makeColor's 256-based encoding
  return (((r << 16) | (g << 8) | b) - 1) / unitMultiplier | 0
}
