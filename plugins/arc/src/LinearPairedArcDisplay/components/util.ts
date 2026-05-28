import { assembleLocString } from '@jbrowse/core/util'
import { SV_SYMBOLIC_ALLELES, parseSvAlt } from '@jbrowse/sv-core'

import type { Feature } from '@jbrowse/core/util'

export function makeFeaturePair(feature: Feature, alt?: string) {
  const start = feature.get('start')
  const refName = feature.get('refName')
  const strand = feature.get('strand')!
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
      strand,
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

export function makeSummary(feature: Feature, alt?: string) {
  const { k1, k2 } = makeFeaturePair(feature, alt)
  return [
    feature.get('name'),
    feature.get('id'),
    assembleLocString(k1),
    assembleLocString(k2),
    feature.get('INFO')?.SVTYPE,
    alt,
  ]
    .filter(Boolean)
    .join('<br/>')
}
