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

// Impact tiers in descending severity, with their legend colors. Exported so
// the "Consequence impact" color legend renders the exact same swatches the
// `impactColor` jexl paints features with.
export const IMPACT_TIERS = [
  { tier: 'HIGH', color: '#d32f2f' },
  { tier: 'MODERATE', color: '#f57c00' },
  { tier: 'LOW', color: '#fbc02d' },
  { tier: 'MODIFIER', color: '#9e9e9e' },
] as const

const IMPACT_COLOR: Record<string, string> = Object.fromEntries(
  IMPACT_TIERS.map(t => [t.tier, t.color]),
)

// The `featureColor` / `color` jexl preset that paints by consequence impact,
// backed by the `impactColor` jexl function registered in the plugin's
// configure(). Shared so the single-variant and multi-sample displays offer the
// same one-click choice and detect it identically.
export const CONSEQUENCE_IMPACT_JEXL = 'jexl:impactColor(feature)'

const NO_IMPACT_COLOR = '#9e9e9e'

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
 * hasPhased) so it isn't offered when every cell would render the same
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
 */
export function getVariantConsequence(feature: Feature) {
  return mostSevereAnnotation(feature)?.[1]?.split('&')[0]?.trim() ?? ''
}

/**
 * A CSS color for the variant's most severe impact tier, for use as a
 * per-feature `color` jexl.
 */
export function getVariantImpactColor(feature: Feature) {
  return IMPACT_COLOR[getVariantImpact(feature)] ?? NO_IMPACT_COLOR
}
