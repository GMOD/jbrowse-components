import {
  HIDDEN_ROW,
  NO_ROW_COLOR,
  RowKeys,
  buildRowTable,
} from '@jbrowse/render-core/marks'

import { buildMultiRowChannels } from './multiRowChannels.ts'

import type { FieldPalette } from '../../RenderFeatureDataRPC/colorClasses.ts'
import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'

export type EncodableRegion = Pick<
  MultiRowRegionData,
  | 'featureStarts'
  | 'featureEnds'
  | 'featureColors'
  | 'rectColorValues'
  | 'colorValues'
  | 'rowValues'
  | 'featureRowValueIndex'
>

/**
 * One region encoded as the display encodes it, with the row table for the
 * rows on screen: `rows` in drawn order, `rowColors[i]` the override row `i`
 * paints, as the arrangement dialog writes them.
 */
export function encodeRows(
  data: EncodableRegion,
  {
    rows,
    rowColors = [],
    hiddenColors = new Set<number>(),
    fieldPalette,
  }: {
    rows: string[]
    rowColors?: (number | undefined)[]
    hiddenColors?: ReadonlySet<number>
    fieldPalette?: FieldPalette
  },
) {
  const rowKeys = new RowKeys()
  for (const name of [...data.rowValues, ...rows]) {
    rowKeys.keyOf(name)
  }
  const slot = new Uint32Array(rowKeys.size).fill(HIDDEN_ROW)
  const color = new Uint32Array(rowKeys.size).fill(NO_ROW_COLOR)
  for (const [i, name] of rows.entries()) {
    slot[rowKeys.keyOf(name)] = i
    color[rowKeys.keyOf(name)] = rowColors[i] ?? NO_ROW_COLOR
  }
  const encoded = buildMultiRowChannels(data, {
    rowKeys,
    hiddenColors,
    fieldPalette,
  })
  return { encoded, rowKeys, rowTable: buildRowTable(slot, color) }
}
