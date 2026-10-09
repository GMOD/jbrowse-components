/**
 * #api
 * The named ramps a continuous color scale's `scheme` takes, each one a stop
 * table in `colorRamp.ts` that every ramp baker reads, so no display can name
 * a scheme nothing bakes. `viridis`, `magma`, `inferno` and `cividis` are
 * matplotlib's perceptual ramps, dark at the low end; `juicebox` fades from
 * transparent to red, as Juicebox paints contacts; `fall` runs white through
 * yellow and red to black, as HiGlass does; `reds` and `blues` are
 * ColorBrewer's, from white; `redblue` and `purpleorange` diverge through
 * white, ColorBrewer's RdBu and PuOr; `redgreyblue` diverges through a grey
 * middle, which stays visible on a white page where a white middle would not,
 * as the MAF display's identity ramp paints it;
 * `blueyellowred` is ColorBrewer's RdYlBu turned round, so low reads cool and
 * high hot through a pale yellow middle, as `dnds` paints.
 */
export const COLOR_SCHEMES = [
  'viridis',
  'magma',
  'inferno',
  'cividis',
  'juicebox',
  'fall',
  'reds',
  'blues',
  'redblue',
  'purpleorange',
  'redgreyblue',
  'blueyellowred',
] as const

/** #api */
export type ColorSchemeName = (typeof COLOR_SCHEMES)[number]

/**
 * #api
 * The ramp a continuous scale samples while it names no `range` and no
 * `scheme`, so a declaration spelling it out and one leaving it unset resolve
 * alike.
 */
export const DEFAULT_COLOR_SCHEME: ColorSchemeName = 'viridis'
