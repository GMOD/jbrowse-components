import { SimpleFeature } from '@jbrowse/core/util'

import type { VariantFeatureInfo } from './types.ts'

export function enrichFeatureFromClick(
  baseFeature: { id(): string; toJSON(): Record<string, unknown> },
  featureInfo: VariantFeatureInfo | undefined,
  // Which sample's cell was clicked, when one was. Omitted by the variant lane,
  // whose marks are records: the widget's "Sample:" card is keyed off
  // `clickedSample`, and a lane click has no sample to name — stamping an empty
  // one would put a blank card on the record's own details.
  clickResult?: {
    sampleName: string
    genotype: string
    alleles: string
  },
) {
  return new SimpleFeature({
    id: baseFeature.id(),
    data: {
      ...baseFeature.toJSON(),
      // genotypes is intentionally omitted: the variant feature widget's
      // sample grid reads `samples`, not `genotypes`, and the multi-sample
      // displays don't supply `samples` here. Stamping the full per-feature
      // genotype map only bloated the localStorage-persisted selected feature.
      ...(featureInfo
        ? {
            REF: featureInfo.ref,
            ALT: featureInfo.alt,
            description: featureInfo.description,
            // type drives the widget's breakend / SV navigation panels
            type: featureInfo.type,
          }
        : {}),
      ...(clickResult
        ? {
            clickedSample: clickResult.sampleName,
            clickedGenotype: clickResult.genotype,
            clickedAlleles: clickResult.alleles,
          }
        : {}),
    },
  })
}
