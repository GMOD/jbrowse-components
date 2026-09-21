/**
 * #api
 * The named ramps a continuous colour scale's `scheme` takes, each one a stop
 * table in `colorRamp.ts` that every ramp baker reads, so no display can name
 * a scheme nothing bakes.
 */
export const COLOR_SCHEMES = ['viridis'] as const

/** #api */
export type ColorSchemeName = (typeof COLOR_SCHEMES)[number]
