import { SimpleFeature } from '@jbrowse/core/util'
import { parseSvAlt } from '@jbrowse/sv-core'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

/**
 * The refNames a feature's chord touches, resolved in the same order the
 * circular view's `getEndpoint` resolves them: a VCF breakend (a BND ALT, or a
 * symbolic allele plus INFO.CHR2) first, then an explicit `mate` field.
 *
 * Reading INFO.CHR2 off the serialized feature directly would miss BND mates
 * entirely — their only coordinate lives in the ALT string — and would hand
 * getCanonicalRefName an array, since VCF INFO values are always arrays.
 */
export function featureRefNames(data: SimpleFeatureSerialized) {
  const feature = new SimpleFeature(data)
  const alt = (feature.get('ALT') as string[] | undefined)?.[0]
  const mate = feature.get('mate') as { refName?: string } | undefined
  return [
    feature.get('refName'),
    parseSvAlt(feature, alt)?.mateRefName,
    mate?.refName,
  ]
}
