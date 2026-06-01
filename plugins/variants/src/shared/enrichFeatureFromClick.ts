import { SimpleFeature } from '@jbrowse/core/util'

import type { VariantFeatureInfo } from './types.ts'

export function enrichFeatureFromClick(
  baseFeature: { id(): string; toJSON(): Record<string, unknown> },
  featureInfo: VariantFeatureInfo | undefined,
  clickResult: {
    sampleName: string
    genotype: string
    alleles: string
  },
) {
  return new SimpleFeature({
    id: baseFeature.id(),
    data: {
      ...baseFeature.toJSON(),
      ...(featureInfo
        ? {
            REF: featureInfo.ref,
            ALT: featureInfo.alt,
            description: featureInfo.description,
            genotypes: featureInfo.genotypes,
          }
        : {}),
      clickedSample: clickResult.sampleName,
      clickedGenotype: clickResult.genotype,
      clickedAlleles: clickResult.alleles,
    },
  })
}
