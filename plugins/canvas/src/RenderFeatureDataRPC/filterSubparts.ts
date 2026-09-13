import { SimpleFeature } from '@jbrowse/core/util'

import { impliedUTRs } from './impliedUTRs.ts'
import { featureType, getSubfeatures } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

// A synthesized UTR carries the `parent` handle so anything reaching up from
// the box it paints — a `feature.parent` jexl, the itemRgb walk — finds the
// transcript rather than painting default between exons that took a color.
function impliedUTRFeatures(parent: Feature, subs: Feature[]) {
  const refName = parent.get('refName')
  const strand = parent.get('strand') ?? 0
  return impliedUTRs(parent, subs).map(
    ({ start, end, type, side, source }) =>
      new SimpleFeature({
        id:
          source === parent
            ? `${parent.id()}-utr-${side}`
            : `${source.id()}-utr${side === 'right' ? '2' : ''}`,
        data: { refName, start, end, strand, type },
        parent,
      }),
  )
}

// The slot is one string for the whole track and this runs once per
// transcript, so the split is kept for as long as the string stays the same.
let allowedSubParts: { slot: string; types: Set<string> } | undefined

function allowedSubPartTypes(subParts: string) {
  if (allowedSubParts?.slot !== subParts) {
    allowedSubParts = {
      slot: subParts,
      types: new Set(subParts.split(',').map(t => t.trim().toLowerCase())),
    }
  }
  return allowedSubParts.types
}

export function getSubparts(f: Feature, config: DisplayConfig) {
  let c = getSubfeatures(f)
  if (c.length === 0) {
    return []
  }
  if (config.impliedUTRs) {
    c = [...c, ...impliedUTRFeatures(f, c)]
  }
  const allowedTypes = allowedSubPartTypes(config.subParts)
  return c.filter(child => allowedTypes.has(featureType(child).toLowerCase()))
}
