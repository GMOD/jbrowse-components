import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { featureHeightPx, layoutChild, sortByPosition } from './glyphUtils.ts'

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

function isMatureProteinType(feature: Feature) {
  return MATURE_PROTEIN_TYPES.has(featureType(feature).toLowerCase())
}

function getMatureProteinChildren(feature: Feature): Feature[] {
  return getSubfeatures(feature).filter(isMatureProteinType)
}

export function hasMatureProteinChildren(feature: Feature) {
  return getMatureProteinChildren(feature).length > 0
}

// Every polyprotein CDS in the subtree. Each is its own reading frame, so each
// translates independently — collected at whatever depth it sits (gene → CDS, or
// gene → mRNA → CDS), since findGlyph reaches it at either. Shared by the
// translation pass and the emitter's label-disambiguation so the two agree on
// what counts as a polyprotein.
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
  // the polyprotein CDS's own resolved height; every cleavage-product row is a
  // uniform slice of it, so the rows stay even whatever the expression returns
  const heightPx = featureHeightPx(feature, args)

  const matureProteins = getMatureProteinChildren(feature)
  const sortedChildren = sortByPosition(
    matureProteins.map(child => layoutChild(child, args)),
  )

  // findGlyph only routes here when hasMatureProteinChildren, but the glyph is
  // callable directly, and a zero-height CDS would vanish rather than degrade to
  // a plain box.
  const numRows = Math.max(1, sortedChildren.length)
  // One body row per cleavage product, and — in `below` mode — one COUNTED label
  // row under each (see FeatureLayout.labelRowsAbove).
  //
  // This used to double the row and split it box/label, which put the label's
  // share in geometry units: the main thread then scaled it by HEIGHT_MULTIPLIERS
  // while the label drew on the gentler LABEL_FONT_MULTIPLIERS, so the half
  // reserved for text came out smaller than the text — 10px against 11px in
  // normal mode, 6px against 8.25px in compact, 3px against 7.15px in
  // superCompact. Unlike the transcript path's version of this, it overflowed in
  // NORMAL mode too, because halving the row also halved what a full-size label
  // had to live in.
  const rowHeight = heightPx
  const totalHeight = rowHeight * numRows

  const padding = 1
  const boxHeight = rowHeight - padding * 2
  const below = subfeatureLabels === 'below'

  for (const [i, child] of sortedChildren.entries()) {
    child.y = i * rowHeight + padding
    child.height = boxHeight
    // i products above this one, each having spent a label row
    child.labelRowsAbove = below ? i : 0
    child.ownsLabelRow = below
  }

  return {
    feature,
    glyphType: 'MatureProteinRegion',
    y: 0,
    height: totalHeight,
    children: sortedChildren,
    // propagates to the containing gene's row (and to this feature's own
    // flatbush extent when the CDS is top-level)
    labelRows: below ? numRows : 0,
  }
}
