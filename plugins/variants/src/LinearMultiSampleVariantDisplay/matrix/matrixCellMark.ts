import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { makeAbgrFill } from '@jbrowse/render-core/marks/colorFill'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { f2 } from '../../shared/constants.ts'
import * as shader from './shaders/variantMatrix.generated.ts'
import { drawnCellHeightPx } from './shaders/variantMatrix.js.generated.ts'

import type { InkRect, MarkFrame, MarkShape } from '@jbrowse/render-core/marks'

/**
 * The `matrixCell` shape's channels: a rect on column `featureIndex` of
 * `numFeatures` equal columns across the canvas, on `row`, in `color`.
 */
export interface MatrixCellChannels {
  featureIndex: Float32Array
  row: Uint32Array
  color: Uint32Array
  count: number
}

export interface MatrixCellParams {
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

  writeUniforms(scratch, _clip, _block, frame, params) {
    shader.writeUniforms(scratch, {
      numFeatures: params.numFeatures,
      canvasWidth: frame.canvasWidth,
      canvasHeight: frame.canvasHeight,
      rowHeight: params.rowHeight,
      scrollTop: params.scrollTop,
      // The shader rebuilds the backing-store width as `canvasWidth * dpr` to
      // snap column edges to physical pixels, so this has to be the ratio
      // `hal.resize` sized the store with, cap included.
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, _block, frame, params) {
    const { color, count } = channels
    // The two axes take different rules, and the X one is load-bearing: columns
    // paint at float coordinates with a small overdraw (f2) so sub-pixel
    // columns antialias and blend. No pixel-snap and no 1px minimum on X —
    // that decimates sub-pixel columns.
    //
    // Y is the opposite, because rows carry the genotype and columns do not.
    // Cells are ordered ref-then-nonref so alt paints over ref, and at 2,504
    // samples a row is 0.09px: a variant drawn `rowHeight + f2` tall covers a
    // third of the pixel it shares with ten reference cells and blends away,
    // while the GPU paints the same variant across the whole
    // `drawnCellHeightPx` band and it survives. Measured on the 1000 Genomes
    // phase 3 matrix: the export kept 41% of the strongly-coloured variant
    // pixels the screen showed. So a sub-pixel row takes the shader's floor
    // and its exact anchor, and a normal row keeps the seam overdraw.
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const r = cellRect(channels, frame, params, i)
      if (r) {
        setFill(color[i]!)
        ctx.fillRect(r.left, r.top, r.width, r.height)
      }
    }
  },

  ink(channels, _block, frame, params, i) {
    return cellRect(channels, frame, params, i)
  },
}

function cellRect(
  channels: MatrixCellChannels,
  frame: MarkFrame,
  params: MatrixCellParams,
  i: number,
): InkRect | undefined {
  const { featureIndex, row } = channels
  const { canvasWidth, canvasHeight } = frame
  const { numFeatures, rowHeight, scrollTop } = params
  if (numFeatures === 0) {
    return undefined
  }
  const cellWidth = canvasWidth / numFeatures
  const drawnRowHeight = drawnCellHeightPx(rowHeight)
  const floored = drawnRowHeight > rowHeight
  const top = row[i]! * rowHeight - scrollTop - (floored ? 0 : f2)
  const height = floored ? drawnRowHeight : rowHeight + f2
  return top + height < 0 || top > canvasHeight
    ? undefined
    : {
        left: featureIndex[i]! * cellWidth - f2,
        top,
        width: cellWidth + f2,
        height,
      }
}
