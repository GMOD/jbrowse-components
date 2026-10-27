import { SimpleFeature } from '@jbrowse/core/util'

import { impliedUTRs } from './impliedUTRs.ts'
import { featureType, getSubfeatures } from './util.ts'

import type { Feature } from '@jbrowse/core/util'

// A synthesized UTR carries the `parent` handle so anything reaching up from
// the box it paints — a `feature.parent` jexl, the itemRgb walk — finds the
// transcript rather than painting default between exons that took a color.
function impliedUTRFeatures(parent: Feature, subs: Feature[]) {
  const refName = parent.get('refName')
  const strand = parent.get('strand') ?? 0
  const seen = new Set<string>()
  return impliedUTRs(parent, subs).map(({ start, end, type, side, source }) => {
    const base =
      source === parent
        ? `${parent.id()}-utr-${side}`
        : `${source.id()}-utr${side === 'right' ? '2' : ''}`
    const id = seen.has(base) ? `${base}-${start}` : base
    seen.add(base)
    return new SimpleFeature({
      id,
      data: { refName, start, end, strand, type },
      parent,
    })
  })
}

// The boxes a coding transcript draws. Its exons stay out: the CDS and UTR
// boxes, implied UTRs included, already tile them.
const SUBPART_TYPES = new Set([
  'cds',
  'utr',
  'five_prime_utr',
  'three_prime_utr',
])

export function getSubparts(f: Feature) {
  const subs = getSubfeatures(f)
  if (subs.length === 0) {
    return []
  }
  return [...subs, ...impliedUTRFeatures(f, subs)].filter(child =>
    SUBPART_TYPES.has(featureType(child).toLowerCase()),
  )
}
