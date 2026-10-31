import { getBpDisplayStr } from '@jbrowse/core/util'

import { makeSimpleAltString } from '../../VcfFeature/util.ts'
import { carrierSummary } from '../recordCarriers.ts'

import type { VariantFeatureInfo } from '../../shared/types.ts'
import type { RecordCarriers } from '../recordCarriers.ts'

// The tooltip fields both layouts' hit tests produce, each beside the record's
// `featureInfo`. The index
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
  carriers?: string
}

// Hover-dedup identity for a hovered cell — same feature+sample+genotype in the
// same displayed region means the same tooltip AND the same highlight geometry,
// so `hoverVariantSurface` skips redundant setHoveredFeature calls. The region
// term matters when overlapping displayed regions show two copies of one
// record: without it, sliding onto the second copy deduped away the `onHover`
// that moves the highlight box. Typed wider than the fields so the model's own
// hover slot can be keyed too.
export function variantTooltipKey(f: {
  name: string
  genotype: string
  featureId?: unknown
  displayedRegionIndex?: unknown
}) {
  return `${f.name}:${f.genotype}:${f.featureId}:${f.displayedRegionIndex}`
}

// The reference span, past one base: a SNV's or an insertion's single base
// says nothing an insertion's own row does not
function spanText(length: number) {
  return length > 1 ? getBpDisplayStr(length) : ''
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
  // insertion its column's record makes. Both layouts zero it by the cell's
  // `cellAltDosage`.
  insertedBp: number
  displayedRegionIndex?: number
}): VariantTooltipFields {
  return {
    genotype,
    alleles: makeSimpleAltString(genotype, info.ref, info.alt),
    featureName: info.name,
    description:
      info.alt.length >= 3 ? 'multiple ALT alleles' : info.description,
    length: spanText(info.length),
    // The inserted bp, which `length` (the reference span, ~1 bp for any
    // insertion) cannot say. Empty for everything else, which getTooltipRows
    // drops.
    insertion: insertedBp > 0 ? `${insertedBp}bp` : '',
    sampleName,
    name,
    featureId,
    displayedRegionIndex,
  }
}

/**
 * The same fields for a hover naming a RECORD rather than a (record, sample)
 * cell: the records band, which has no row to read a genotype off. The sample
 * fields are `''`, so one hover slot serves both bands: `getTooltipRows` drops
 * an empty value, and `hoveredTooltipSource` reads the empty `name` as no row
 * to merge.
 * `line` is the record's line, what `records.tooltip.field` reads, the
 * record's name by default.
 */
export function buildRecordHit({
  info,
  line = info.name,
  featureId,
  displayedRegionIndex,
  carriers,
}: {
  info: VariantFeatureInfo
  line?: string
  featureId: string
  displayedRegionIndex?: number
  carriers?: RecordCarriers
}): VariantTooltipFields {
  return {
    genotype: '',
    sampleName: '',
    name: '',
    // the description spells the record's REF and ALTs, or an SV's class
    // and size
    alleles: '',
    featureName: line,
    description: info.description,
    length: spanText(info.length),
    insertion: info.insertedBp > 0 ? `${info.insertedBp}bp` : '',
    carriers: carriers ? carrierSummary(carriers) : '',
    featureId,
    displayedRegionIndex,
  }
}
