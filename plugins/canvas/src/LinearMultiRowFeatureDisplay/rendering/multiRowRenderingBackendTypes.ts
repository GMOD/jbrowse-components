import type {
  RowKeys,
  RowTable,
  SpanChannels,
} from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type { MultiRowRegionData } from '../../MultiRowGetFeaturesRPC/rpcTypes.ts'

// The three inputs to "does this feature paint, and in what color", in drawn
// row space: what the indel-glyph overlay and the sort-at-column read. All
// three are required, because `featurePainting` reads them together and the
// rule inverts if one goes missing.
export interface MultiRowFeaturePaintInputs {
  // partition value -> global row index
  rowIndexByValue: ReadonlyMap<string, number>
  // ABGR per-row override by global row index; `undefined` entries paint the
  // worker-baked per-feature color
  rowColorsByIndex: readonly (number | undefined)[]
  // ABGR colors of legend categories toggled off; matching features are omitted
  // at encode time and so reach neither backend
  hiddenColors: ReadonlySet<number>
}

/**
 * What the encode reads: the keys the instances carry, and the two inputs the
 * hidden-category rule needs. The drawn row and the row colour are the row
 * table's, so a reorder, focus or recolour re-encodes nothing.
 */
export interface MultiRowEncodeInputs {
  rowKeys: RowKeys
  // rows painting a per-row colour override, which the legend never lists, so
  // a baked colour equal to a hidden category must not hide their features
  overriddenRows: ReadonlySet<string>
  hiddenColors: ReadonlySet<number>
}

export interface MultiRowRenderState extends MultiRowFeaturePaintInputs {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowProportion: number
  rowTable: RowTable
}

// The `span` channels are encoded on the main thread, once per region
// arrival; the row table carries every later change to the rows.
export type MultiRowRenderingBackend = PerRegionRenderingBackend<
  SpanChannels,
  MultiRowRenderState
>
