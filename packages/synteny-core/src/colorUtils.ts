import { category10 } from '@jbrowse/core/ui/colors'
import {
  alpha as setAlpha,
  formatHEXA,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

/**
 * #api
 * Deterministic non-negative 32-bit hash of a string.
 */
export function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * #api
 * Stable category10 color for a query name, via `hashString`.
 */
export function getQueryColor(queryName: string) {
  const hash = hashString(queryName)
  return category10[hash % category10.length]!
}

// CIGAR operation colors. Kept opaque — every consumer either runs them
// through applyAlpha() or packs them via cssColorToABGR() and applies an
// alpha uniform in the shader / `a * alpha` in Canvas2D. A non-opaque
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

// Strand-specific CIGAR operation colors: same as default but purple indels
// (N/D) instead of green/blue. Derived so the shared ops can't drift apart.
export const strandCigarColors = {
  ...defaultCigarColors,
  N: '#a020f0',
  D: '#a020f0',
}

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

// Closed set of color-scheme keys shared between linear-comparative-view and
// dotplot-view UIs and worker code. Stored in MST models as plain
// `types.string` for snapshot-compat but every API surface — the menu
// builder, the setter, the color-function dispatch — uses this literal so
// the compiler covers every case.
export type SyntenyColorBy =
  | 'default'
  | 'strand'
  | 'query'
  | 'target'
  | 'identity'
  | 'identityDiverging'
  | 'meanQueryIdentity'
  | 'meanQueryMappingQuality'
  | 'mappingQuality'

/**
 * #api
 * Applies an alpha to a CSS color, returning the original when `a === 1`.
 */
export function applyAlpha(color: string, a: number) {
  if (a === 1) {
    return color
  }
  return formatHEXA(setAlpha(parseCssColor(color), a))
}
