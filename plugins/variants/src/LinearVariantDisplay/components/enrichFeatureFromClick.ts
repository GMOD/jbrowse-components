import { SimpleFeature } from '@jbrowse/core/util'

import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { VariantTooltipFields } from './buildVariantHit.ts'
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
 * A genotype cell's hit as the clicked record, its sample card included:
 * the click both cell layouts hand the feature widget and the record menu.
 */
export function enrichCellHit(
  model: { featureById(featureId: string): Feature | undefined },
  hit: { fields: VariantTooltipFields; featureInfo: VariantFeatureInfo },
) {
  const baseFeature = model.featureById(hit.fields.featureId)
  return baseFeature
    ? enrichFeatureFromClick(baseFeature, hit.featureInfo, hit.fields)
    : undefined
}

/**
 * The record as the adapter holds it, INFO and every sample's FORMAT fields
 * included, with the clicked cell's sample card kept from the click.
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
