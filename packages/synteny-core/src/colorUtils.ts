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
// `a * alpha` in Canvas2D, or blendOverGround() for a legend chip. A non-opaque
// literal here would multiply with that alpha and render fainter than intended.
//
// Opaque is also what lets the synteny indel wedge be pre-blended with the band's
// ground and written out opaque rather than composited, which is the arrangement
// `LinearSyntenyDisplay/syntenyGroundClear` fixes that ground for.
//
// These remain LIGHT-GROUND colours — picked against a white band, and at the
// 0.2 default alpha they are faint on a dark one. The ground is threaded now,
// which is what makes a dark band expressible at all; giving these a dark
// variant, in the `colorPairLRDark` mould, is the separate follow-up.
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

// The runtime modes the colour functions, legends and menus dispatch on. A
// view or display holds a colour object (`SyntenyColor`, `RibbonColor`) and
// `syntenyColorByOf` maps it onto one of these.
const syntenyColorByValues = [
  'default',
  'strand',
  'query',
  'target',
  'reference',
  'identity',
  'mappingQuality',
  'dnds',
  'track',
] as const

/**
 * A color-by mode: one of the named presets, or `attribute:<name>` naming a
 * numeric feature attribute the track happens to carry.
 *
 * The open arm keeps this list from gaining a member per measurement anyone
 * wants to see. A preset is a preset because it carries domain knowledge
 * a column name cannot — identity is a fraction, MAPQ tops out at 60, dN/dS
 * pivots at 1 — not because it is the only way to paint a number.
 */
export type SyntenyColorBy =
  | (typeof syntenyColorByValues)[number]
  | AttributeColorBy

/** The mode that paints a column the track declares. */
export type AttributeColorBy = `${typeof ATTRIBUTE_PREFIX}${string}`

/** The measurements painted on a ramp, under the menu's Color by value. */
export type MeasurementColorBy = Extract<
  SyntenyColorBy,
  'identity' | 'mappingQuality' | 'dnds'
>

/**
 * #api
 * The colorBy mode that paints a named feature attribute.
 */
export function attributeColorBy(attribute: string): AttributeColorBy {
  return `${ATTRIBUTE_PREFIX}${attribute}`
}

/**
 * #api
 * The attribute a colorBy mode names, or undefined for a named preset.
 */
export function colorByAttributeName(colorBy: SyntenyColorBy) {
  return colorBy.startsWith(ATTRIBUTE_PREFIX)
    ? colorBy.slice(ATTRIBUTE_PREFIX.length)
    : undefined
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
 * {@link blendOverGround} for a legend chip, floored at
 * {@link LEGEND_CHIP_ALPHA_FLOOR}.
 */
export function legendChipColor(color: string, alpha: number, ground: string) {
  return blendOverGround(
    color,
    Math.max(alpha, LEGEND_CHIP_ALPHA_FLOOR),
    ground,
  )
}

/**
 * #api
 * Composite a CSS color over `ground` by `a`, returning an opaque `rgb(...)`.
 * The synteny canvas draws every ribbon at the view's global alpha over the
 * band's ground (shadeFill in syntenyTypes.slang / resolveInstanceFill in the
 * Canvas2D renderer), so a full-saturation legend swatch reads wrong — a red
 * match ribbon shows as salmon over a white band, a blue deletion as pale blue.
 * Blending the legend chip the same way keeps the key matched to what's actually
 * on screen, which means blending it over the SAME ground the renderers cleared
 * to rather than over an assumed white.
 */
export function blendOverGround(color: string, a: number, ground: string) {
  if (a >= 1) {
    return color
  }
  const [r, g, b] = cssColorToRgb(color)
  const [gr, gg, gb] = cssColorToRgb(ground)
  const mix = (c: number, g: number) => Math.round(c * a + g * (1 - a))
  return `rgb(${mix(r, gr)},${mix(g, gg)},${mix(b, gb)})`
}
