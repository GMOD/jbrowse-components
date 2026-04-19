import {
  getFeatureHeightPx,
  layoutChild,
  sortByPosition,
} from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

const MATURE_PROTEIN_TYPES = new Set([
  'mature_protein_region_of_CDS',
  'mature_protein_region',
])

export function getMatureProteinChildren(feature: Feature): Feature[] {
  const subfeatures = feature.get('subfeatures')
  return (
    subfeatures?.filter(sub =>
      MATURE_PROTEIN_TYPES.has(sub.get('type') ?? ''),
    ) ?? []
  )
}

export function hasMatureProteinChildren(feature: Feature) {
  return getMatureProteinChildren(feature).length > 0
}

export function layoutMatureProteinRegion(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { subfeatureLabels } = config
  const heightPx = getFeatureHeightPx(feature, config)

  const matureProteins = getMatureProteinChildren(feature)
  const sortedChildren = sortByPosition(
    matureProteins.map(child => layoutChild(child, feature, args)),
  )

  const numRows = Math.max(1, sortedChildren.length)
  // 'below' labels need 2x row height: one half for the box, one for the label
  const perRowMultiplier = subfeatureLabels === 'below' ? 2 : 1
  const rowHeight = heightPx * perRowMultiplier
  const totalHeight = rowHeight * numRows

  const padding = 1
  const boxHeight =
    subfeatureLabels === 'below'
      ? Math.floor(rowHeight / 2) - padding
      : rowHeight - padding * 2

  for (const [i, child] of sortedChildren.entries()) {
    child.y = i * rowHeight + padding
    child.height = boxHeight
    child.totalLayoutHeight = rowHeight
  }

  return {
    feature,
    glyphType: 'MatureProteinRegion',
    y: 0,
    height: totalHeight,
    totalLayoutHeight: totalHeight,
    children: sortedChildren,
  }
}
