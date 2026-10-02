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

import { regionWithDeltas } from './featurePainting.ts'
import { multiRowInsertionParams } from './multiRowInsertions.ts'
import { rowBand } from './rowBand.ts'

import type {
  MultiRowRegionData,
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
 * deletion's line and length, from the signed bp deltas the `lengthField` slot
 * packs. The markers themselves are the insertion mark's, on either backend.
 * The walk is the encode the blocks were drawn from, placed through the row
 * table, so a glyph sits on its block whatever hid, moved or recoloured it.
 */
export function drawMultiRowIndelGlyphs(
  ctx: Ctx2D,
  regions: { get(key: number): MultiRowRegionData | undefined },
  uploaded: ReadonlyMap<number, MultiRowUploadData>,
  renderBlocks: RenderBlock[],
  state: MultiRowRenderState,
) {
  const { canvasWidth, canvasHeight, rowHeight, rowProportion, rowTable } =
    state
  const { height: h, offset } = rowBand(rowHeight, rowProportion)
  const insertionParams = multiRowInsertionParams(state)
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
    block => regionWithDeltas(regions.get(block.displayedRegionIndex)),
    (regionData, renderBlock) => {
      const encoded = uploaded.get(renderBlock.displayedRegionIndex)
      if (!encoded) {
        return
      }
      paintBlockInsertionLabels(
        ctx,
        encoded.insertions,
        renderBlock,
        state,
        insertionParams,
      )
      const bpToPx = makeBpMapper(renderBlock)
      const { featureStarts, featureEnds, featureDeltas } = regionData
      const labelFits = h >= MIN_HEIGHT_FOR_TEXT
      let fontSet = false
      for (let c = 0; c < encoded.count; c++) {
        const i = encoded.featureIndex[c]!
        const delta = featureDeltas[i]!
        const rowIndex = rowSlot(encoded.row, c, rowTable)
        if (delta >= 0 || rowIndex === undefined) {
          continue
        }
        const xa = bpToPx(featureStarts[i]!)
        const xb = bpToPx(featureEnds[i]!)
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
          ctx.fillStyle = textOn(
            rowColor(encoded.color[c]!, encoded.row, c, rowTable),
          )
          // the magnitude, not the signed delta: a bare "-9048" reads as a
          // sequence length that went negative, and the glyph already says
          // which direction this is
          ctx.fillText(String(-delta), left + width / 2, yMid - h / 4)
        }
      }
    },
  )
}
