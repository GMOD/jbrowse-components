import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { featureHeightPx, layoutChild, sortByPosition } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Two vocabularies name a cleavage product: NCBI's `*_region_of_CDS` SO family
// and the INSDC feature keys a GenBank flatfile conversion emits. Compared
// case-insensitively, since real-world GFFs vary in case.
const MATURE_PROTEIN_TYPES = new Set([
  'mature_protein_region_of_cds',
  'signal_peptide_region_of_cds',
  'propeptide_region_of_cds',
  'mature_protein_region',
  'mat_peptide',
  'sig_peptide',
  'transit_peptide',
  'propeptide',
])

function isMatureProteinType(feature: Feature) {
  return MATURE_PROTEIN_TYPES.has(featureType(feature).toLowerCase())
}

function getMatureProteinChildren(feature: Feature): Feature[] {
  return getSubfeatures(feature).filter(isMatureProteinType)
}

export function hasMatureProteinChildren(feature: Feature) {
  return getMatureProteinChildren(feature).length > 0
}

// Each polyprotein CDS is its own reading frame and translates independently,
// so the walk collects one at whatever depth it sits.
export function collectPolyproteinCDS(feature: Feature): Feature[] {
  const out: Feature[] = []
  const walk = (f: Feature) => {
    for (const sub of getSubfeatures(f)) {
      if (isCDS(sub) && hasMatureProteinChildren(sub)) {
        out.push(sub)
      } else {
        walk(sub)
      }
    }
  }
  walk(feature)
  return out
}

export function layoutMatureProteinRegion(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { subfeatureLabels } = config
  // Every cleavage-product row is a uniform slice of the CDS's own height, so
  // the rows stay even whatever a `featureHeight` expression returns.
  const heightPx = featureHeightPx(feature, args)

  const matureProteins = getMatureProteinChildren(feature)
  const sortedChildren = sortByPosition(
    matureProteins.map(child => layoutChild(child, args)),
  )

  // findGlyph routes here only when there are children, but the glyph is
  // callable directly and a zero-height CDS would vanish rather than degrade to
  // a plain box.
  const numRows = Math.max(1, sortedChildren.length)
  const rowHeight = heightPx
  const totalHeight = rowHeight * numRows

  const padding = 1
  const boxHeight = rowHeight - padding * 2
  const below = subfeatureLabels === 'below'

  for (const [i, child] of sortedChildren.entries()) {
    child.y = i * rowHeight + padding
    child.height = boxHeight
    child.labelRowsAbove = below ? i : 0
    child.ownsLabelRow = below
  }

  return {
    feature,
    glyphType: 'MatureProteinRegion',
    y: 0,
    height: totalHeight,
    children: sortedChildren,
    labelRows: below ? numRows : 0,
  }
}
