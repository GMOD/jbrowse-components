import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

/**
 * #api
 * `hashString` is a deterministic non-negative 32-bit hash of a string;
 * `getQueryColor` is the stable category10 color it maps a query name to. Both
 * now live in core, which owns them so that every by-refName coloring — this
 * package's views and the alignments display's mateRefName scheme — hashes a
 * contig to the same color. Re-exported here to keep the published API stable.
 */
export { getQueryColor, hashString } from '@jbrowse/core/ui/colors'

// CIGAR operation colors. Kept opaque — consumers pack them (cssColorToABGR /
// parseCssColor) and apply alpha separately: an alpha uniform in the shader,
// `a * alpha` in Canvas2D, or blendOverWhite() for a legend chip. A non-opaque
// literal here would multiply with that alpha and render fainter than intended.
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
    // The dotplot draws each alignment as one flat black point rather than the
    // ribbon's red match block. Lives here so its renderer and its legend chip
    // read the same constant.
    pointColor: '#000',
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
//
// The type is derived from the value list rather than declared alongside it:
// coerceColorBy needs a runtime membership test, and two hand-maintained copies
// would let a newly added mode typecheck everywhere while coerceColorBy
// silently rejected it back to 'default'.
const syntenyColorByValues = [
  'default',
  'strand',
  'query',
  'target',
  'reference',
  'identity',
  'meanQueryIdentity',
  'mappingQuality',
] as const

export type SyntenyColorBy = (typeof syntenyColorByValues)[number]

const syntenyColorBySet: ReadonlySet<string> = new Set(syntenyColorByValues)

function isSyntenyColorBy(value: string): value is SyntenyColorBy {
  return syntenyColorBySet.has(value)
}

/**
 * #api
 * Coerce a persisted colorBy string (stored as plain `types.string` for
 * snapshot-compat) to a valid `SyntenyColorBy`. Unknown values fall back to
 * 'default'; the retired 'identityDiverging' mode maps to 'identity' so old
 * saved sessions keep rendering instead of hitting an unhandled switch case.
 */
export function coerceColorBy(value: string | undefined): SyntenyColorBy {
  if (value === 'identityDiverging') {
    return 'identity'
  }
  return value !== undefined && isSyntenyColorBy(value) ? value : 'default'
}

/**
 * #api
 * Composite a CSS color over white by `a`, returning an opaque `rgb(...)`. The
 * synteny canvas draws every ribbon at the view's global alpha over the white
 * page (shadeFill in syntenyTypes.slang / resolveInstanceFill in the Canvas2D
 * renderer), so a full-saturation legend swatch reads wrong — a red match ribbon
 * shows as salmon, a blue deletion as pale blue. Blending the legend chip the
 * same way keeps the key matched to what's actually on screen.
 */
export function blendOverWhite(color: string, a: number) {
  if (a >= 1) {
    return color
  }
  const [r, g, b] = cssColorToRgb(color)
  const mix = (c: number) => Math.round(c * a + 255 * (1 - a))
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`
}
