import { assembleLocString } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'
import type { FeaturePair } from '@jbrowse/sv-core'

interface Endpoint {
  refName: string
  start: number
  end: number
}

// Canonical, orientation-independent key for an arc: a paired feature is
// emitted from both endpoints' interval trees (flip r1/r2), and reciprocal VCF
// BNDs are two records pointing at each other, so the same physical connection
// arrives twice with the endpoints swapped. Sorting the two endpoint locstrings
// collapses those to one key so the arc is drawn once. The key is deliberately
// ALT-independent: reciprocal BNDs carry distinct ALT strings for the same
// junction, so folding them requires keying on the endpoints alone.
export function pairKey(k1: Endpoint, k2: Endpoint) {
  const a = `${k1.refName}:${k1.start}-${k1.end}`
  const b = `${k2.refName}:${k2.start}-${k2.end}`
  return [a, b].sort().join('|')
}

// Takes the pair the caller already built: `makeFeaturePair` runs `parseSvAlt`,
// and computing it here ran that a second time for every arc.
export function makeSummary(
  feature: Feature,
  alt: string | undefined,
  { k1, k2 }: FeaturePair,
) {
  return [
    feature.get('name'),
    feature.get('id'),
    assembleLocString(k1),
    assembleLocString(k2),
    (feature.get('INFO') as { SVTYPE?: unknown } | undefined)?.SVTYPE,
    alt,
  ]
    .filter(Boolean)
    .join('<br/>')
}
