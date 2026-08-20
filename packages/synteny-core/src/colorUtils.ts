import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

import { ATTRIBUTE_PREFIX } from './colorRamps.ts'

/**
 * #api
 * `hashString` is a deterministic non-negative 32-bit hash of a string;
 * `getQueryColor` is the stable category10 color it maps a query name to.
 *
 * Both live in core, which owns the whole by-refName vocabulary so that every
 * display painting by contig — this package's views and the alignments display's
 * mateRefName scheme — gives one contig one color. `refNameColor` is that rule;
 * `getQueryColor` is only its no-assembly-order fallback, kept exported because
 * it is published API. Re-exported here for the same reason.
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
//
// #valueList colorBy — and a third copy is what the URL parameters page had,
// which named nine of these ten and had done since `dnds` was added.
const syntenyColorByValues = [
  'default',
  'strand',
  'query',
  'target',
  'reference',
  'identity',
  'meanQueryIdentity',
  'mappingQuality',
  'dnds',
  'track',
] as const

/**
 * A color-by mode: one of the named presets, or `attribute:<name>` naming a
 * numeric feature attribute the track happens to carry.
 *
 * The open arm is what keeps this list from gaining a member per measurement
 * anyone wants to see. A preset is a preset because it carries domain knowledge
 * a column name cannot — identity is a fraction, MAPQ tops out at 60, dN/dS
 * pivots at 1 — not because it is the only way to paint a number.
 */
export type SyntenyColorBy =
  | (typeof syntenyColorByValues)[number]
  | `${typeof ATTRIBUTE_PREFIX}${string}`

const syntenyColorBySet: ReadonlySet<string> = new Set(syntenyColorByValues)

function isSyntenyColorBy(value: string): value is SyntenyColorBy {
  return (
    syntenyColorBySet.has(value) ||
    (value.startsWith(ATTRIBUTE_PREFIX) &&
      value.length > ATTRIBUTE_PREFIX.length)
  )
}

/**
 * #api
 * The colorBy string that paints a named feature attribute.
 */
export function attributeColorBy(attribute: string) {
  return `${ATTRIBUTE_PREFIX}${attribute}` as SyntenyColorBy
}

/**
 * #api
 * The attribute a colorBy names, or undefined for a named preset. `attribute:`
 * with nothing after it never reaches here — coerceColorBy rejects it.
 */
export function colorByAttributeName(colorBy: SyntenyColorBy) {
  return colorBy.startsWith(ATTRIBUTE_PREFIX)
    ? colorBy.slice(ATTRIBUTE_PREFIX.length)
    : undefined
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
 * The alpha a legend chip is blended at however faint the ribbons are.
 *
 * Matching the chip to the composited ribbon is right down to a point and then
 * inverts: the linear-synteny default alpha is 0.2, and at that value every
 * chip washes to within a few percent of white, so a key meant to say "blue is
 * this track, orange is that one" identifies nothing. Below the floor the chip
 * gives up exactness for the one job it has. The ribbons themselves still draw
 * at the real alpha.
 */
export const LEGEND_CHIP_ALPHA_FLOOR = 0.45

/**
 * #api
 * {@link blendOverWhite} for a legend chip, floored at
 * {@link LEGEND_CHIP_ALPHA_FLOOR}.
 */
export function legendChipColor(color: string, alpha: number) {
  return blendOverWhite(color, Math.max(alpha, LEGEND_CHIP_ALPHA_FLOOR))
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
