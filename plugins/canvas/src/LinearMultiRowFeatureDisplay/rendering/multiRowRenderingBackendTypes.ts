import type { FieldPalette } from '../../RenderFeatureDataRPC/colorClasses.ts'
import type { MultiRowEncoded } from './multiRowChannels.ts'
import type { MultiRowInsertions } from './multiRowInsertions.ts'
import type { RowKeys, RowTable } from '@jbrowse/render-core/marks'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type { MultiRowRegionData } from '../../MultiRowGetFeaturesRPC/rpcTypes.ts'

/**
 * What the encode reads: the keys the instances carry, the hidden categories'
 * colors and the color field's palette. The drawn row and the row color
 * are the row table's, so a reorder, focus or recolor re-encodes nothing.
 * A row color paints only while every block's own color is the default,
 * which no legend lists, so a hide never reaches a row-colored block.
 */
export interface MultiRowEncodeInputs {
  rowKeys: RowKeys
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

/**
 * What one region uploads: its blocks' `span` channels and the insertion
 * markers its `lengthField` gains wear, both encoded on the main thread once
 * per region arrival; the row table carries every later change to the rows.
 */
export interface MultiRowUploadData extends MultiRowEncoded {
  insertions: MultiRowInsertions
}

export type MultiRowRenderingBackend = PerRegionRenderingBackend<
  MultiRowUploadData,
  MultiRowRenderState
>
