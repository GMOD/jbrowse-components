/**
 * Features per bin over one region, the payload of the density tier that
 * stands in for the features a gated fetch refused. Absolute genomic
 * coordinates; `exact` says whether the bins were counted (a sidecar) or
 * estimated (an index).
 */
export interface FeatureDensity {
  starts: Uint32Array
  ends: Uint32Array
  scores: Float32Array
  exact: boolean
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
