import { SimpleFeature } from '@jbrowse/core/util'

import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { Feature } from '@jbrowse/core/util'

export function enrichFeatureFromClick(
  baseFeature: { id(): string; toJSON(): Record<string, unknown> },
  featureInfo: VariantFeatureInfo | undefined,
  // omitted by the records band, whose marks name a record and no sample: the
  // widget's "Sample:" card keys off `clickedSample`
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

/**
 * The record as the adapter holds it, INFO and every sample included, with
 * the clicked cell's sample card kept from the click.
 */
export function withClickedSample(full: Feature, clicked: Feature) {
  const sample = clicked.get('clickedSample')
  return new SimpleFeature({
    id: clicked.id(),
    data: {
      ...full.toJSON(),
      ...(sample === undefined
        ? {}
        : {
            clickedSample: sample,
            clickedGenotype: clicked.get('clickedGenotype'),
            clickedAlleles: clicked.get('clickedAlleles'),
          }),
    },
  })
}
