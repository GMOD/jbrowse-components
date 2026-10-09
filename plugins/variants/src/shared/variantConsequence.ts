import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'

import type { Feature } from '@jbrowse/core/util'

// SnpEff (INFO/ANN) and VEP (INFO/CSQ) both encode per-transcript annotations
// as an array of pipe-delimited strings. In both formats the consequence SO
// term is field index 1 (ANN "Annotation", CSQ "Consequence") and the impact
// tier is one of these four tokens. Rather than assume the impact column index
// (VEP CSQ field order is user-configurable), we scan each annotation for the
// unambiguous impact token.
const IMPACT_RANK: Record<string, number> = {
  HIGH: 4,
  MODERATE: 3,
  LOW: 2,
  MODIFIER: 1,
}

const IMPACT_PRESET = UNIVERSAL_FIELD_PRESETS.impact

/** The domain value a record with no SnpEff/VEP annotation files under. */
export const UNANNOTATED_IMPACT = IMPACT_PRESET.missing

const IMPACT_COLOR: Record<string, string> = Object.fromEntries(
  IMPACT_PRESET.domain.map((tier, i) => [tier, IMPACT_PRESET.range[i]!]),
)

const NO_IMPACT_COLOR = IMPACT_COLOR[UNANNOTATED_IMPACT]!

/** The impact tiers in descending severity, with the colors the preset paints. */
export const IMPACT_TIERS = IMPACT_PRESET.domain
  .filter(tier => tier !== UNANNOTATED_IMPACT)
  .map(tier => ({ tier, color: IMPACT_COLOR[tier]! }))

/** The field a variant's most severe consequence tier is read under. */
export const IMPACT_FIELD = 'impact'

function annotationStrings(feature: Feature) {
  const info = feature.get('INFO') as Record<string, unknown> | undefined
  const ann = info?.ANN
  if (Array.isArray(ann)) {
    return ann as string[]
  }
  const csq = info?.CSQ
  return Array.isArray(csq) ? (csq as string[]) : []
}

// The most functionally-severe annotation for the variant, split into its
// pipe-delimited fields, or undefined when the variant carries no ANN/CSQ.
function mostSevereAnnotation(feature: Feature) {
  let best: string[] | undefined
  let bestRank = -1
  for (const entry of annotationStrings(feature)) {
    const parts = entry.split('|')
    let rank = 0
    for (const part of parts) {
      const r = IMPACT_RANK[part.trim()]
      if (r !== undefined && r > rank) {
        rank = r
      }
    }
    if (rank > bestRank) {
      bestRank = rank
      best = parts
    }
  }
  return best
}

/**
 * Whether the variant carries any SnpEff/VEP annotation at all — used to gate
 * the "color cells by consequence" menu option (like phased mode is gated on
 * hasPhasedOrHaploid) so it isn't offered when every cell would render the same
 * no-impact grey.
 */
export function featureHasConsequence(feature: Feature) {
  return annotationStrings(feature).length > 0
}

/**
 * Impact tier (HIGH/MODERATE/LOW/MODIFIER) of the most severe SnpEff/VEP
 * annotation on the variant, or '' when unannotated.
 */
export function getVariantImpact(feature: Feature) {
  const parts = mostSevereAnnotation(feature)
  for (const part of parts ?? []) {
    const t = part.trim()
    if (IMPACT_RANK[t] !== undefined) {
      return t
    }
  }
  return ''
}

/**
 * SO consequence term (e.g. missense_variant) of the most severe SnpEff/VEP
 * annotation on the variant, or '' when unannotated. When an annotation lists
 * several `&`-joined consequences the first is returned.
 *
 * Unlike the impact tier (scanned via its fixed HIGH/MODERATE/LOW/MODIFIER
 * vocabulary), SO terms are an open vocabulary with no scannable token set, so
 * this indexes field 1 — the consequence column in SnpEff ANN (spec-fixed) and
 * in the *default* VEP CSQ order. A non-default `--fields` CSQ layout would need
 * the header's Format definition to locate the column; not parsed here.
 */
export function getVariantConsequence(feature: Feature) {
  return mostSevereAnnotation(feature)?.[1]?.split('&')[0]?.trim() ?? ''
}

/**
 * Every SO consequence term the variant carries — across all transcripts, and
 * `&`-expanded — deduped, in file order. Same field-1 caveat as
 * {@link getVariantConsequence}.
 *
 * An "is it missense anywhere" filter needs the full list, and neither obvious
 * spelling gives it. `consequence(feature)` reports the *most severe*
 * annotation alone, so a variant that is missense on one transcript and
 * stop_gained on another reads back `stop_gained`; and
 * `includes(feature.INFO.CSQ, 'missense_variant')` reaches
 * `Array.prototype.includes`, which compares whole pipe-delimited entries and
 * so is false for every real record. Both make the filter drop matching
 * features, and a filtered track shows nothing of what it dropped.
 */
export function getVariantConsequences(feature: Feature) {
  const terms: string[] = []
  for (const entry of annotationStrings(feature)) {
    for (const term of entry.split('|')[1]?.split('&') ?? []) {
      const trimmed = term.trim()
      if (trimmed && !terms.includes(trimmed)) {
        terms.push(trimmed)
      }
    }
  }
  return terms
}

/**
 * The impact scale's domain value for a variant: its most severe tier, or
 * {@link UNANNOTATED_IMPACT}.
 */
export function getVariantImpactDomain(feature: Feature) {
  return getVariantImpact(feature) || UNANNOTATED_IMPACT
}

/**
 * A CSS color for the variant's most severe impact tier, for use as a
 * per-feature `color` jexl.
 */
export function getVariantImpactColor(feature: Feature) {
  return IMPACT_COLOR[getVariantImpact(feature)] ?? NO_IMPACT_COLOR
}

/** The swatch {@link getVariantImpactColor} paints one domain value with. */
export function getImpactColor(tier: string) {
  return IMPACT_COLOR[tier] ?? NO_IMPACT_COLOR
}
