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
      // no genotypes: this is the click's own record, off the cell payload;
      // the record the widget opens is the adapter's (`withClickedSample`)
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
 * The record as the adapter holds it, INFO included, with the clicked cell's
 * sample card kept from the click. Its `samples`, every sample's FORMAT
 * fields, go where genotype rows draw: the rows show them, and the widget's
 * feature persists to localStorage. With no rows they stay, as
 * `LinearVariantDisplay` shows them.
 */
export function withClickedSample(
  full: Feature,
  clicked: Feature,
  keepSamples: boolean,
) {
  const sample = clicked.get('clickedSample')
  const { samples, ...record } = full.toJSON()
  return new SimpleFeature({
    id: clicked.id(),
    data: {
      ...record,
      ...(keepSamples ? { samples } : {}),
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
