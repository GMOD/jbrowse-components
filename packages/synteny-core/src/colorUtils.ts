import { abgrAlpha, cssColorToRgb } from '@jbrowse/core/util/colorBits'

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

// Alpha under 1% once the opacity slider applies: the floor below which a
// comparative display neither paints an instance on its Canvas2D/SVG path nor
// lets the pick hit it. One function because the two answers have to agree — a
// pick that weighed the packed byte alone left a plot faded to 0 blank and
// still hoverable. A synteny location marker passes 1, since it is drawn at its
// packed alpha whatever the slider says.
export function isInstanceInvisible(packedColor: number, displayAlpha: number) {
  return abgrAlpha(packedColor) * displayAlpha < 3
}
