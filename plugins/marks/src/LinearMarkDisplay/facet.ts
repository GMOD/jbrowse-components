import {
  facetSectionOrder,
  groupKeyComparator,
} from '@jbrowse/core/util/groupKeys'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { FacetSection } from '@jbrowse/core/util/markEncoding'

/**
 * The sections across every loaded region: each key's band is the union of
 * the bands the regions gave it, since a group the worker met in two regions
 * need not have packed to the same depth in both. One region — the common
 * case — is its own table exactly. The order is `facetSectionOrder` over the
 * facet's two slots, which is the order the worker stacked them in.
 */
export function foldFacetSections(
  map: ReadonlyMap<number, MarkRegionData>,
  field: string,
  domain?: readonly string[],
): FacetSection[] {
  const bands = new Map<string, { label: string; rowCount: number }>()
  for (const { layers } of map.values()) {
    for (const layer of layers) {
      for (const { key, label, rowCount } of layer.facet ?? []) {
        const band = bands.get(key)
        if (band) {
          band.rowCount = Math.max(band.rowCount, rowCount)
        } else {
          bands.set(key, { label, rowCount })
        }
      }
    }
  }
  let next = 0
  const order = facetSectionOrder(field, domain)
  return [...bands.keys()].sort(groupKeyComparator(order)).map(key => {
    const { label, rowCount } = bands.get(key)!
    const section = { key, label, firstRow: next, rowCount }
    next += rowCount
    return section
  })
}

/**
 * Where each section sits once the hidden ones are gone: the visible bands
 * re-cumulated from the top, and the rows they need between them. A hidden
 * section keeps no space — the same answer the canvas and alignments displays
 * give a hidden group.
 */
export interface FacetLayout {
  sections: FacetSection[]
  rowCount: number
}

export function visibleFacetLayout(
  folded: readonly FacetSection[],
  hidden: ReadonlySet<string>,
): FacetLayout {
  const sections: FacetSection[] = []
  let next = 0
  for (const { key, label, rowCount } of folded) {
    if (hidden.has(key)) {
      continue
    }
    sections.push({ key, label, firstRow: next, rowCount })
    next += rowCount
  }
  return { sections, rowCount: next }
}

// A row no visible section holds. `rowCount` rows fill the plot exactly, so
// the row after the last draws below it and is clipped — which is how a
// hidden section's instances leave the picture without the lanes beside
// `row` being compacted, and why the hit test cannot reach them either.
function rowRemap(table: readonly FacetSection[], layout: FacetLayout) {
  const newFirst = new Map(layout.sections.map(s => [s.key, s.firstRow]))
  const total = table.reduce((n, s) => Math.max(n, s.firstRow + s.rowCount), 0)
  const remap = new Uint32Array(total).fill(layout.rowCount)
  for (const { key, firstRow, rowCount } of table) {
    const to = newFirst.get(key)
    if (to === undefined) {
      continue
    }
    for (let i = 0; i < rowCount; i++) {
      remap[firstRow + i] = to + i
    }
  }
  return remap
}

function facetLayer(layer: StoredLayer, layout: FacetLayout): StoredLayer {
  const { facet, row } = layer
  if (!facet || !row) {
    return layer
  }
  const remap = rowRemap(facet, layout)
  const moved = new Uint32Array(row.length)
  for (let i = 0; i < row.length; i++) {
    moved[i] = remap[row[i]!] ?? layout.rowCount
  }
  return { ...layer, row: moved, facet: layout.sections }
}

/**
 * Every region's rows re-offset onto one layout, so the chips and the bands
 * they name agree whichever region a span came from and whatever the reader
 * has hidden. The worker's own offsets are the group boundaries this reads.
 */
export function remapFacetRows(
  map: ReadonlyMap<number, MarkRegionData>,
  layout: FacetLayout,
): ReadonlyMap<number, MarkRegionData> {
  return new Map(
    [...map].map(([index, data]) => [
      index,
      { layers: data.layers.map(layer => facetLayer(layer, layout)) },
    ]),
  )
}
