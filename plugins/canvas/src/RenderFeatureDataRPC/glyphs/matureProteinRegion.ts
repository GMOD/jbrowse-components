import { layoutChild, sortByPosition } from './glyphUtils.ts'
import { featureType, getSubfeatures } from '../util.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Cleavage-product children of a CDS, all rendered as stacked sub-regions along
// it. Two vocabularies land here:
//   - NCBI RefSeq GFF3 SO terms: the `*_region_of_CDS` family (SO:0002205 etc.,
//     created to annotate polypeptide regions on nucleotides — see
//     github.com/The-Sequence-Ontology/SO-Ontologies/issues/484), plus the bare
//     `mature_protein_region` (SO:0000419) for non-NCBI sources.
//   - INSDC/GenBank feature keys (`mat_peptide`, `sig_peptide`,
//     `transit_peptide`, `propeptide`; ebi.ac.uk/ena/WebFeat): what a GenBank
//     flatfile → GFF3 conversion of a downloaded viral genome (enterovirus,
//     poliovirus, …) emits. Without these, such a CDS drops its cleavage
//     products to one flat box instead of the stacked glyph.
// Compared case-insensitively, matching isCDS/isExon — real-world GFFs vary in
// case and the dispatch and layout paths must agree (see util.ts isCDS).
// Example data: test_data/enterovirus_d (RefSeq NC_001430.1, a gene → CDS →
// mature_protein_region_of_CDS polyprotein) and test_data/sars-cov2
// (ORF1a/ORF1ab); rendered by the `gene_track_mature_peptides` and
// `gallery/sarscov2_polyprotein` website demos.
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

export function isMatureProteinType(feature: Feature) {
  return MATURE_PROTEIN_TYPES.has(featureType(feature).toLowerCase())
}

function getMatureProteinChildren(feature: Feature): Feature[] {
  return getSubfeatures(feature).filter(isMatureProteinType)
}

export function hasMatureProteinChildren(feature: Feature) {
  return getMatureProteinChildren(feature).length > 0
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
