import type { FieldPalette } from '../../RenderFeatureDataRPC/colorClasses.ts'
import type {
  RowKeys,
  RowTable,
  SpanChannels,
} from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type { MultiRowRegionData } from '../../MultiRowGetFeaturesRPC/rpcTypes.ts'

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
  // the color field's scale while a field paints, which a feature's value
  // paints through in place of its worker-baked color
  fieldPalette?: FieldPalette
}

export interface MultiRowRenderState {
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
