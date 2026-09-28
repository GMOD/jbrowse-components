import { HIDDEN_ROW, buildRowTable } from '@jbrowse/render-core/marks'

import { drawnScales } from './drawnScales.ts'
import { sectionsOn } from './facet.ts'
import { DEFAULT_FLATTEN_FIELD } from './markVocabulary.ts'

import type { MarkRegionData } from './markList.ts'
import type { RowKeys, RowTable } from '@jbrowse/render-core/marks'

/**
 * A region under `rows` with every `row` lane a key: each row of a section the
 * worker stacked holds the key of the value the section is, so the lanes stay
 * put whatever order or focus the rows take. A region `sectionsOn` names no
 * sections for has every instance hidden until its refetch lands.
 */
export function keyRegion(
  region: MarkRegionData,
  rowKeys: RowKeys,
  field: string,
): MarkRegionData {
  const facet = sectionsOn(region, field)
  const depth =
    facet?.reduce((n, s) => Math.max(n, s.firstRow + s.rowCount), 0) ?? 0
  const keyOf = new Uint32Array(depth).fill(HIDDEN_ROW)
  for (const { key, firstRow, rowCount } of facet ?? []) {
    keyOf.fill(rowKeys.keyOf(key), firstRow, firstRow + rowCount)
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
 * leaves it out, and no colour override, since a row's tint is its label's.
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
 * 1 at each key the table draws, or undefined where every loaded instance is
 * drawn: a name only departed regions knew hides nothing, and a region fetched
 * before the split or split on another field hides all of its own.
 */
export function drawnKeysOf(
  { slot }: RowTable,
  regions: Iterable<MarkRegionData>,
  rowKeys: RowKeys,
  field: string,
): Uint8Array | undefined {
  const mask = () => Uint8Array.from(slot, s => (s === HIDDEN_ROW ? 0 : 1))
  for (const region of regions) {
    const facet = sectionsOn(region, field)
    if (!facet) {
      return mask()
    }
    for (const { key } of facet) {
      const k = rowKeys.lookup(key)
      if (k !== undefined && slot[k] === HIDDEN_ROW) {
        return mask()
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
