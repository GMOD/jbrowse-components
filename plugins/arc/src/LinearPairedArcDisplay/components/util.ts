import { assembleLocString } from '@jbrowse/core/util'
import { SV_SYMBOLIC_ALLELES, parseSvAlt } from '@jbrowse/sv-core'

import type { Feature } from '@jbrowse/core/util'

export function makeFeaturePair(feature: Feature, alt?: string) {
  const start = feature.get('start')
  const refName = feature.get('refName')
  const mate = feature.get('mate') as
    | { refName: string; start: number; end: number; mateDirection?: number }
    | undefined
  const parsed = parseSvAlt(feature, alt)
  const isSymbolic = alt
    ? SV_SYMBOLIC_ALLELES.some(a => alt.startsWith(a))
    : false

  return {
    k1: {
      refName,
      start,
      // symbolic alleles: arc spans start→end, so collapse the local end to start+1
      end: parsed && isSymbolic ? start + 1 : feature.get('end'),
      mateDirection: parsed?.joinDirection ?? 0,
    },
    k2: mate ?? {
      refName: parsed?.mateRefName ?? 'unknown',
      end: parsed?.matePos ?? 0,
      start: parsed ? parsed.matePos - 1 : 0,
      mateDirection: parsed?.mateDirection ?? 0,
    },
  }
}

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

export function makeSummary(feature: Feature, alt?: string) {
  const { k1, k2 } = makeFeaturePair(feature, alt)
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
