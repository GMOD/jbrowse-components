import { getBpDisplayStr } from '@jbrowse/core/util'

import { makeSimpleAltString } from '../VcfFeature/util.ts'

import type { VariantFeatureInfo } from './types.ts'

// The tooltip-field contract shared by both multi-sample variant displays. Both
// hit-tests produce these identical fields; each display pairs them with a
// display-specific carrier (`featureInfo`/`cell` vs `featureData`) as a sibling
// so building them here keeps the two displays from drifting. The index
// signature reflects that these records are open — the model merges sample
// metadata attributes into them (`{...source, ...hoveredFeature}`) before the
// tooltip table renders — and lets them satisfy the hook's/model's
// `Record<string, unknown>` hovered-genotype slot without a laundering spread.
export interface VariantTooltipFields {
  [key: string]: unknown
  genotype: string
  alleles: string
  featureName: string
  description: string
  length: string
  insertion: string
  sampleName: string
  name: string
  featureId: string
  displayedRegionIndex?: number
}

// Hover-dedup identity for a hovered cell — same feature+sample+genotype in the
// same displayed region means the same tooltip AND the same highlight geometry,
// so `hoverVariantSurface` skips redundant setHoveredFeature calls. The region
// term matters when overlapping displayed regions show two copies of one
// record: without it, sliding onto the second copy deduped away the `onHover`
// that moves the highlight box. Shared so both displays key hovers identically,
// and typed wider than the fields so the model's own hover slot can be keyed
// too. A variant-lane hover names no sample and carries no genotype, so its key
// is the record's id plus the region, which is exactly the identity that lane
// needs.
export function variantTooltipKey(f: {
  name: string
  genotype: string
  featureId?: unknown
  displayedRegionIndex?: unknown
}) {
  return `${f.name}:${f.genotype}:${f.featureId}:${f.displayedRegionIndex}`
}

export function buildVariantHit({
  info,
  genotype,
  sampleName,
  name,
  featureId,
  insertedBp,
  displayedRegionIndex,
}: {
  info: VariantFeatureInfo
  genotype: string
  sampleName: string
  name: string
  featureId: string
  // bp of insertion THIS cell reports — the record's count when the sample
  // carries the alt, 0 for a reference cell, which must not claim the
  // insertion its column's record makes. The regular display takes this off
  // the picked cell (`pickVariantCell` zeroes it by `cellAltDosage`); the
  // matrix derives it from the decoded genotype.
  insertedBp: number
  displayedRegionIndex?: number
}): VariantTooltipFields {
  return {
    genotype,
    alleles: makeSimpleAltString(genotype, info.ref, info.alt),
    featureName: info.name,
    description:
      info.alt.length >= 3 ? 'multiple ALT alleles' : info.description,
    length: getBpDisplayStr(info.length),
    // The count the insertion marker paints on the cell, verbatim, so hovering
    // decodes the number rather than leaving it to be guessed against `length`
    // (the reference span, ~1 bp for any insertion). Empty for everything else,
    // which getTooltipRows drops.
    insertion: insertedBp > 0 ? `${insertedBp}bp` : '',
    sampleName,
    name,
    featureId,
    displayedRegionIndex,
  }
}

/**
 * The same fields for a hover that names a RECORD rather than a (record, sample)
 * cell: the variant lane's marks, where there is one mark per variant and no row
 * under the cursor to read a genotype off.
 *
 * The three fields that name a sample are `''` rather than absent, which is what
 * makes one hover slot serve both bands: `getTooltipRows` drops an empty value,
 * so the table is the record's rows alone, and `hoveredTooltipSource` reads the
 * empty `name` as "no sample row whose metadata to merge in".
 *
 * `alleles` is `REF > ALT` here, not the resolved pair a genotype names — the
 * record's own alleles are the only allele fact a lane mark carries, and they
 * are what a `LinearVariantDisplay` would report for the same click. Multiple
 * ALTs are listed rather than summarized as "multiple ALT alleles" (the cells'
 * wording, which exists because a genotype's *color* stops being decodable past
 * two alts) since the row spells them out.
 */
export function buildVariantLaneHit({
  info,
  featureId,
  displayedRegionIndex,
}: {
  info: VariantFeatureInfo
  featureId: string
  displayedRegionIndex?: number
}): VariantTooltipFields {
  return {
    genotype: '',
    sampleName: '',
    name: '',
    alleles: `${info.ref} > ${info.alt.join(',')}`,
    featureName: info.name,
    description: info.description,
    length: getBpDisplayStr(info.length),
    insertion: info.insertedBp > 0 ? `${info.insertedBp}bp` : '',
    featureId,
    displayedRegionIndex,
  }
}
