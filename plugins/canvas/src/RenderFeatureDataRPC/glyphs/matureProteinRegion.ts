import { reservesBelowLabelRow } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { boxLayout, featureHeightPx } from './glyphUtils.ts'

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

// One row per product. A product written over several lines under one ID, such
// as nsp12 straddling the ORF1ab frameshift, is one product: its lines share a
// row, and the row's layout carries them as children.
function productRows(feature: Feature) {
  const rows: Feature[][] = []
  const byId = new Map<string, Feature[]>()
  const children = getMatureProteinChildren(feature).toSorted(
    (a, b) => a.get('start') - b.get('start') || b.get('end') - a.get('end'),
  )
  for (const child of children) {
    const id = child.get('id')
    const row = typeof id === 'string' ? byId.get(id) : undefined
    if (row) {
      row.push(child)
    } else {
      const fresh = [child]
      rows.push(fresh)
      if (typeof id === 'string') {
        byId.set(id, fresh)
      }
    }
  }
  return rows
}

export function layoutMatureProteinRegion(args: LayoutArgs): FeatureLayout {
  const { feature, config, jexl } = args
  // Every cleavage-product row is a uniform slice of the CDS's own height, so
  // the rows stay even whatever a `featureHeight` expression returns.
  const rowHeight = featureHeightPx(feature, args)
  const padding = 1
  const boxHeight = rowHeight - padding * 2

  let labelRows = 0
  const children = productRows(feature).map((lines, i) => {
    const row = boxLayout(lines[0]!, boxHeight)
    if (lines.length > 1) {
      row.children = lines.map(line => boxLayout(line, boxHeight))
    }
    row.y = i * rowHeight + padding
    row.labelRowsAbove = labelRows
    row.ownsLabelRow = reservesBelowLabelRow({
      feature: row.feature,
      config,
      glyphType: 'Box',
      jexl,
    })
    if (row.ownsLabelRow) {
      labelRows++
    }
    return row
  })

  // findGlyph routes here only when there are children, but the glyph is
  // callable directly and a zero-height CDS would vanish rather than degrade to
  // a plain box.
  return {
    feature,
    glyphType: 'MatureProteinRegion',
    y: 0,
    height: rowHeight * Math.max(1, children.length),
    children,
    labelRows,
  }
}
