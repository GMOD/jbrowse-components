import { layoutChild, sortByPosition } from './glyphUtils.ts'
import { featureType, getSubfeatures } from '../util.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// The complete `*_region_of_CDS` family NCBI emits as children of a CDS; all
// render as stacked sub-regions along the CDS. `mature_protein_region` (no
// `_of_CDS`) is the bare SO term, kept for non-NCBI sources.
const MATURE_PROTEIN_TYPES = new Set([
  'mature_protein_region_of_CDS',
  'signal_peptide_region_of_CDS',
  'propeptide_region_of_CDS',
  'mature_protein_region',
])

function getMatureProteinChildren(feature: Feature): Feature[] {
  return getSubfeatures(feature).filter(sub =>
    MATURE_PROTEIN_TYPES.has(featureType(sub)),
  )
}

export function hasMatureProteinChildren(feature: Feature) {
  return getSubfeatures(feature).some(sub =>
    MATURE_PROTEIN_TYPES.has(featureType(sub)),
  )
}

export function layoutMatureProteinRegion(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { subfeatureLabels } = config
  const heightPx = config.featureHeight

  const matureProteins = getMatureProteinChildren(feature)
  const sortedChildren = sortByPosition(
    matureProteins.map(child => layoutChild(child, args)),
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
