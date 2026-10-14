import {
  MIN_HEIGHT_FOR_TEXT,
  paintBlockInsertionLabels,
} from '@jbrowse/alignments-core'
import { getContrastText } from '@jbrowse/core/ui/palette'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'
import { rowColor, rowSlot } from '@jbrowse/render-core/marks'

import { multiRowInsertionParams } from './multiRowIndels.ts'
import { rowBand } from './rowBand.ts'

import type {
  MultiRowRenderState,
  MultiRowUploadData,
} from './multiRowRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// A block whose class palette says "deletion" is itself grey, so the theme's
// own `deletion` grey would vanish into the line. Dark neutral instead.
const DELETION_LINE_COLOR = '#333'
const DELETION_LINE_H = 2
const FONT = '10px sans-serif'
const DELETION_LABEL_MIN_PX = 30

/**
 * The text over the multi-row blocks: each insertion marker's count, and each
 * deletion's line and length. The markers themselves are the insertion mark's,
 * on either backend. Both walk the upload the blocks were drawn from, placed
 * through the row table, so a glyph sits on its block whatever hid, moved or
 * recolored it.
 */
export function drawMultiRowIndelGlyphs(
  ctx: Ctx2D,
  uploaded: ReadonlyMap<number, MultiRowUploadData>,
  renderBlocks: RenderBlock[],
  state: MultiRowRenderState,
) {
  const { canvasWidth, canvasHeight, rowHeight, rowProportion, rowTable } =
    state
  const { height: h, offset } = rowBand(rowHeight, rowProportion)
  const insertionParams = multiRowInsertionParams(state)
  const labelFits = h >= MIN_HEIGHT_FOR_TEXT
  const labelColor = new Map<number, string>()
  const textOn = (abgr: number) => {
    let text = labelColor.get(abgr)
    if (text === undefined) {
      text = getContrastText(abgrToCssRgba(abgr))
      labelColor.set(abgr, text)
    }
    return text
  }

  forEachClippedBlock(
    ctx,
    renderBlocks,
    canvasWidth,
    canvasHeight,
    block => uploaded.get(block.displayedRegionIndex),
    ({ insertions, deletions }, renderBlock) => {
      paintBlockInsertionLabels(
        ctx,
        insertions,
        renderBlock,
        state,
        insertionParams,
      )
      const bpToPx = makeBpMapper(renderBlock)
      const { x, x2, row, length, color, count } = deletions
      let fontSet = false
      for (let k = 0; k < count; k++) {
        const rowIndex = rowSlot(row, k, rowTable)
        if (rowIndex === undefined) {
          continue
        }
        const xa = bpToPx(x[k]!)
        const xb = bpToPx(x2[k]!)
        const yMid = Math.round(offset + rowHeight * rowIndex + h / 2)
        const left = Math.min(xa, xb)
        const width = Math.abs(xb - xa)
        ctx.fillStyle = DELETION_LINE_COLOR
        ctx.fillRect(left, yMid - DELETION_LINE_H / 2, width, DELETION_LINE_H)
        if (labelFits && width >= DELETION_LABEL_MIN_PX) {
          if (!fontSet) {
            ctx.font = FONT
            ctx.textBaseline = 'middle'
            ctx.textAlign = 'center'
            fontSet = true
          }
          // the label sits above the line, so it reads against the block
          ctx.fillStyle = textOn(rowColor(color[k]!, row, k, rowTable))
          // the magnitude, not a signed delta: a bare "-9048" reads as a
          // sequence length that went negative
          ctx.fillText(String(length[k]), left + width / 2, yMid - h / 4)
        }
      }
    },
  )
}
