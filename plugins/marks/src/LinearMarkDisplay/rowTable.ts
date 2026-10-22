import { HIDDEN_ROW, buildRowTable } from '@jbrowse/render-core/marks'

import { drawnScales } from './drawnScales.ts'
import { sectionsOn } from './facet.ts'
import { DEFAULT_FLATTEN_FIELD } from './markVocabulary.ts'

import type { FacetLayout } from './facet.ts'
import type { MarkRegionData } from './markList.ts'
import type { RowKeys, RowTable } from '@jbrowse/render-core/marks'

/** The name a row is keyed by: its section's value, and its depth there. */
export type RowName = (key: string, depth: number) => string

/** The keys a split region's rows hold, and the name each is keyed by. */
export interface RowKeySpace {
  rowKeys: RowKeys
  rowName: RowName
}

/** Under `rows`: every row a section stacks is the section's one row. */
export const sectionRowName: RowName = key => key

/**
 * Under a facet: a row is its section and its depth there, so the table can
 * place it however deep or wherever the layout puts the section.
 */
export const facetRowName: RowName = (key, depth) => `${key}\u0000${depth}`

/**
 * A split region with every `row` lane a key: each row of a section the
 * worker stacked holds the key `rowName` names it by, so the lanes stay put
 * whatever order, focus, hiding or depth the layout gives the rows. A region
 * `sectionsOn` names no sections for has every instance hidden until its
 * refetch lands.
 */
export function keyRegion(
  region: MarkRegionData,
  rowKeys: RowKeys,
  field: string,
  rowName: RowName,
): MarkRegionData {
  const facet = sectionsOn(region, field)
  const depth =
    facet?.reduce((n, s) => Math.max(n, s.firstRow + s.rowCount), 0) ?? 0
  const keyOf = new Uint32Array(depth).fill(HIDDEN_ROW)
  for (const { key, firstRow, rowCount } of facet ?? []) {
    for (let d = 0; d < rowCount; d++) {
      keyOf[firstRow + d] = rowKeys.keyOf(rowName(key, d))
    }
  }
  return {
    ...region,
    layers: region.layers.map(layer => ({
      ...layer,
      row: layer.row
        ? layer.row.map(r => keyOf[r] ?? HIDDEN_ROW)
        : new Uint32Array(layer.count).fill(HIDDEN_ROW),
    })),
  }
}

/**
 * The row table for `order`, top to bottom, over the keys `keyNames` names:
 * each key's slot is its name's place in the order, hidden where the order
 * leaves it out, and no color override, since a row's color draws only its
 * label bar.
 */
export function markRowTable(
  keyNames: readonly string[],
  order: readonly string[],
): RowTable {
  const slotOf = new Map(order.map((name, i) => [name, i]))
  return buildRowTable(
    Uint32Array.from(keyNames, name => slotOf.get(name) ?? HIDDEN_ROW),
  )
}

/**
 * The row table for a facet's layout over the keys `keyNames` names, each a
 * `facetRowName`: its slot is its section's first row plus its depth, hidden
 * where the section is hidden or the layout holds it shallower than the depth,
 * as it does a depth only a mark outside its zoom range reaches.
 */
export function facetRowTable(
  keyNames: readonly string[],
  layout: FacetLayout,
): RowTable {
  return buildRowTable(
    Uint32Array.from(keyNames, name => {
      const at = name.lastIndexOf('\u0000')
      const band = layout.bandOf.get(name.slice(0, at))
      const depth = Number(name.slice(at + 1))
      return band && depth < band.rowCount ? band.firstRow + depth : HIDDEN_ROW
    }),
  )
}

/**
 * 1 at each key the table draws, or undefined where every loaded instance is
 * drawn: a name only departed regions knew hides nothing, and a region fetched
 * before the split or split on another field hides all of its own.
 */
export function drawnKeysOf(
  { slot }: RowTable,
  regions: Iterable<MarkRegionData>,
  rowKeys: RowKeys,
  field: string,
  rowName: RowName,
): Uint8Array | undefined {
  const mask = () => Uint8Array.from(slot, s => (s === HIDDEN_ROW ? 0 : 1))
  for (const region of regions) {
    const facet = sectionsOn(region, field)
    if (!facet) {
      return mask()
    }
    for (const { key, rowCount } of facet) {
      for (let d = 0; d < rowCount; d++) {
        const k = rowKeys.lookup(rowName(key, d))
        if (k !== undefined && slot[k] === HIDDEN_ROW) {
          return mask()
        }
      }
    }
  }
  return undefined
}

/**
 * The region with each layer's key and extents over the instances whose key
 * `drawnKeys` marks, its lanes shared, not copied.
 */
export function drawnRegion(
  region: MarkRegionData,
  drawnKeys: Uint8Array,
): MarkRegionData {
  return {
    ...region,
    layers: region.layers.map(layer => drawnScales(layer, drawnKeys)),
  }
}

/**
 * Whether an adapter's row listing over `field` names the rows on
 * `rowsField`: the rows are on the field itself (`rows: "source"`), or on the
 * key a `flatten` among `steps` wrote over it (`rows: "species"` behind a
 * flatten over a MAF block's `alignments`).
 */
export function listingNamesRows(
  rowsField: string,
  field: string,
  steps: readonly { type: string; field?: string; key?: string }[],
) {
  return (
    rowsField === field ||
    steps.some(
      step =>
        step.type === 'flatten' &&
        (step.field || DEFAULT_FLATTEN_FIELD) === field &&
        step.key === rowsField,
    )
  )
}
