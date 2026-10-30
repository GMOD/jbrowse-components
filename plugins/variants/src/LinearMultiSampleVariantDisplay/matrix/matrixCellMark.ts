import { backingScale } from '@jbrowse/render-core/canvas2dUtils'
import { makeAbgrFill } from '@jbrowse/render-core/marks/colorFill'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { f2 } from '../../shared/constants.ts'
import * as shader from './shaders/variantMatrix.generated.ts'
import {
  drawnCellHeightPx,
  snappedRowBottomPx,
  snappedRowTopPx,
} from './shaders/variantMatrix.js.generated.ts'

import type { InkRect, MarkFrame, MarkShape } from '@jbrowse/render-core/marks'

/**
 * The `matrixCell` shape's channels: a rect on column `featureIndex` of
 * `numFeatures` equal columns across the canvas, on `row`, in `color`.
 */
export interface MatrixCellChannels {
  featureIndex: Uint32Array
  row: Uint32Array
  color: Uint32Array
  count: number
}

interface MatrixCellParams {
  /** How many columns the canvas width is divided into; the payload's. */
  numFeatures: number
  /** CSS px per row; the painted height floors at 1 (`drawnCellHeightPx`). */
  rowHeight: number
  /** Rows-area scroll offset in CSS px. */
  scrollTop: number
}

/**
 * A matrix cell addressed by column index rather than bp: the x axis is
 * `numFeatures` equal columns over the canvas, so the block the backend hands
 * in carries only the clip. This display's own shape, beside the shader whose
 * generated `drawnCellHeightPx` its hit test reads.
 */
export const matrixCellMark: MarkShape<MatrixCellChannels, MatrixCellParams> = {
  id: 'matrixCell',
  pass: {
    ...slangPass({ id: 'matrixCell', mod: shader }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, _block, frame, params) {
    shader.writeUniforms(scratch, {
      numFeatures: params.numFeatures,
      canvasHeight: frame.canvasHeight,
      rowHeight: params.rowHeight,
      scrollTop: params.scrollTop,
      backingWidthPx: clip.pxW,
      devicePixelRatio: clip.scaleY,
    })
  },

  paintBlock(ctx, channels, _block, frame, params) {
    const { color, count } = channels
    // The two axes take different rules, and the X one is load-bearing: columns
    // paint at float coordinates with a small overdraw (f2) so sub-pixel
    // columns antialias and blend. No pixel-snap and no 1px minimum on X —
    // that decimates sub-pixel columns.
    //
    // Y is the opposite, because rows carry the genotype and columns do not:
    // each row paints the shader's snapped band, floor included, so a sub-pixel
    // variant keeps the whole pixel the GPU gives it over the reference cells
    // it shares that pixel with, and rows tile without a seam.
    const setFill = makeAbgrFill(ctx)
    const dpr = backingScale(frame.canvasHeight)
    for (let i = 0; i < count; i++) {
      const r = cellRect(channels, frame, params, dpr, i)
      if (r) {
        setFill(color[i]!)
        ctx.fillRect(r.left, r.top, r.width, r.height)
      }
    }
  },

  ink(channels, _block, frame, params, i) {
    return cellRect(
      channels,
      frame,
      params,
      backingScale(frame.canvasHeight),
      i,
    )
  },
}

function cellRect(
  channels: MatrixCellChannels,
  frame: MarkFrame,
  params: MatrixCellParams,
  dpr: number,
  i: number,
): InkRect | undefined {
  const { featureIndex, row } = channels
  const { canvasWidth, canvasHeight } = frame
  const { numFeatures, rowHeight, scrollTop } = params
  if (numFeatures === 0) {
    return undefined
  }
  const cellWidth = canvasWidth / numFeatures
  const top = snappedRowTopPx(row[i]!, rowHeight, scrollTop, dpr)
  const bottom = snappedRowBottomPx(
    row[i]!,
    rowHeight,
    drawnCellHeightPx(rowHeight),
    scrollTop,
    dpr,
  )
  return bottom < 0 || top > canvasHeight
    ? undefined
    : {
        left: featureIndex[i]! * cellWidth - f2,
        top,
        width: cellWidth + f2,
        height: bottom - top,
      }
}
