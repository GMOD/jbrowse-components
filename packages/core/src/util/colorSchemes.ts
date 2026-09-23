/**
 * #api
 * The named ramps a continuous colour scale's `scheme` takes, each one a stop
 * table in `colorRamp.ts` that every ramp baker reads, so no display can name
 * a scheme nothing bakes. `juicebox` fades from transparent to red, as
 * Juicebox paints contacts; `fall` runs white through yellow and red to black,
 * as HiGlass does; `reds` and `blues` run from white.
 */
export const COLOR_SCHEMES = [
  'viridis',
  'juicebox',
  'fall',
  'reds',
  'blues',
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
