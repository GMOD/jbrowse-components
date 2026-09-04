/**
 * A density source's intervals over one region, the payload of the density
 * tier that stands in for the features a gated fetch refused: features per bin
 * for a `make-density` sidecar, whatever the bigWig measures otherwise, each
 * value a level over its span so a zoomed read means the same thing. Absolute
 * genomic coordinates.
 */
export interface FeatureDensity {
  starts: Uint32Array
  ends: Uint32Array
  scores: Float32Array
}

/**
 * The slot a feature adapter spreads to take a density sidecar — a
 * quantitative sub-adapter (typically a BigWig of feature starts per bin) the
 * display reads at the view's bp/px in place of features the region-too-large
 * gate refused. Mirrors MAF's `summaryAdapter`: on the adapter, so the tier
 * names the file it summarizes.
 */
export const densityAdapterConfigSchemaFields = {
  /**
   * #slot
   */
  densityAdapter: {
    type: 'frozen',
    defaultValue: null,
    description:
      'optional quantitative sub-adapter (e.g. a BigWigAdapter over a features-per-bin bigWig) drawn as a density band where the region is too large to fetch features; null disables it',
  },
} as const

/**
 * Whether the `densityAdapter` slot holds something a sub-adapter can be built
 * from. Beside the slot because both ends of the tier ask it and they have to
 * agree: the display, deciding the band stands in, and `getFeatureDensity`,
 * resolving the sidecar. They disagreed — the display took any object, the
 * adapter wanted a type — so the shorthand every location slot accepts
 * (`{ uri }`) turned the band on for a read that answered `undefined`, which
 * commits nothing, and the phase then waited on bins no read would ever bring.
 */
export function isDensitySourceConfig(
  value: unknown,
): value is Record<string, unknown> & { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  )
}
