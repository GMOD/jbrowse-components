import { getBpDisplayStr } from '@jbrowse/core/util'

import { makeSimpleAltString } from '../VcfFeature/util.ts'

import type { VariantFeatureInfo } from './types.ts'

// The tooltip-field contract shared by both multi-sample variant displays. Both
// hit-tests produce these identical fields (plus a display-specific carrier for
// the enrich step); building them here keeps the two displays from drifting.
export interface VariantTooltipFields {
  genotype: string
  alleles: string
  featureName: string
  description: string
  length: string
  sampleName: string
  name: string
  featureId: string
}

export function buildVariantHit({
  info,
  genotype,
  sampleName,
  name,
  featureId,
}: {
  info: VariantFeatureInfo
  genotype: string
  sampleName: string
  name: string
  featureId: string
}): VariantTooltipFields {
  return {
    genotype,
    alleles: makeSimpleAltString(genotype, info.ref, info.alt),
    featureName: info.name,
    description:
      info.alt.length >= 3 ? 'multiple ALT alleles' : info.description,
    length: getBpDisplayStr(info.length),
    sampleName,
    name,
    featureId,
  }
}
