import { getBpDisplayStr } from '@jbrowse/core/util'

import { makeSimpleAltString } from '../VcfFeature/util.ts'

import type { VariantFeatureInfo } from './types.ts'

// The tooltip-field contract shared by both multi-sample variant displays. Both
// hit-tests produce these identical fields; each display pairs them with a
// display-specific carrier (`featureInfo`/`cell` vs `featureData`) as a sibling
// so building them here keeps the two displays from drifting. The index
// signature reflects that these records are open — the model merges sample
// metadata attributes into them (`{...source, ...hoveredGenotype}`) before the
// tooltip table renders — and lets them satisfy the hook's/model's
// `Record<string, unknown>` hovered-genotype slot without a laundering spread.
export interface VariantTooltipFields {
  [key: string]: unknown
  genotype: string
  alleles: string
  featureName: string
  description: string
  length: string
  sampleName: string
  name: string
  featureId: string
}

// Hover-dedup identity for a hovered cell — same feature+sample+genotype means
// the same tooltip, so the hook skips redundant setHoveredGenotype calls. Shared
// so both displays key hovers identically.
export function variantTooltipKey(f: VariantTooltipFields) {
  return `${f.name}:${f.genotype}:${f.featureId}`
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
