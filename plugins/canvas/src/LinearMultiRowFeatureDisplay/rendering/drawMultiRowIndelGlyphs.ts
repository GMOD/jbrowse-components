import {
  MIN_HEIGHT_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
  insertionBarWidth,
} from '@jbrowse/alignments-core'
import { getContrastText } from '@jbrowse/core/ui/palette'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  makeBpMapper,
  pxPerBpOf,
} from '@jbrowse/render-core/canvas2dUtils'

import {
  drawnFeatureContext,
  forEachDrawnFeature,
  regionWithDeltas,
} from './featurePainting.ts'
import { rowBand } from './rowBand.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
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
 * Text color for a label drawn ON one of these blocks. No constant reads on
 * every block, because the painting's colors are the user's. Memoized per
 * background because `getContrastText` parses a color string and a painting
 * repeats a handful of them across every block it has.
 */
function makeLabelColorResolver() {
  const cache = new Map<string, string>()
  return (background: string) => {
    let text = cache.get(background)
    if (text === undefined) {
      text = getContrastText(background)
      cache.set(background, text)
    }
    return text
  }
}

/**
 * Alignment-style indel glyphs over the multi-row blocks, from the signed bp
 * deltas the `lengthField` slot packs. A block's width can only express how
 * much reference a feature covers, so these glyphs are where the length goes.
 *
 * `insertionColor` must be `palette.insertion`, which is what the pileup
 * paints, not alignments-core's `INSERTION_COLOR` — that is a different purple
 * for worker code with no theme to read, and hardcoding it leaves these glyphs
 * behind when a custom theme moves the pileup.
 */
export function drawMultiRowIndelGlyphs(
  ctx: Ctx2D,
  regions: { get(key: number): MultiRowRegionData | undefined },
  renderBlocks: RenderBlock[],
  state: MultiRowRenderState,
  insertionColor: string,
) {
  const { canvasWidth, canvasHeight, rowHeight, rowProportion } = state
  const { height: h, offset } = rowBand(rowHeight, rowProportion)
  const labelColor = makeLabelColorResolver()
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  forEachClippedBlock(
    ctx,
    renderBlocks,
    canvasWidth,
    canvasHeight,
    block => regionWithDeltas(regions.get(block.displayedRegionIndex)),
    (regionData, renderBlock) => {
      const bpToPx = makeBpMapper(renderBlock)
      const { featureStarts, featureEnds, featureDeltas } = regionData
      // exact for this block rather than the view's global bpPerPx, which the
      // bar-width and label-fit thresholds are calibrated against
      const pxPerBp = pxPerBpOf(renderBlock)
      const labelFits = h >= MIN_HEIGHT_FOR_TEXT

      forEachDrawnFeature(
        regionData,
        drawnFeatureContext(regionData, state),
        (i, rowIndex, color) => {
          const delta = featureDeltas[i]!
          if (delta === 0) {
            return
          }
          const xa = bpToPx(featureStarts[i]!)
          const xb = bpToPx(featureEnds[i]!)
          const top = offset + rowHeight * rowIndex
          const yMid = Math.round(top + h / 2)
          if (delta > 0) {
            // centered because the allele replaces this whole span, unlike a
            // read's interbase insertion, so it has no boundary to sit at
            const xCenter = (xa + xb) / 2
            // Where the block is already wider than the bar the block *is* the
            // bar — same color, same center — so a second fill only overdraws.
            const barWidth = insertionBarWidth(delta, pxPerBp, h)
            const barDrawn = barWidth > Math.abs(xb - xa)
            if (barDrawn) {
              ctx.fillStyle = insertionColor
              drawInsertionMarker(ctx, xCenter, top, h, delta, pxPerBp)
            }
            if (getInsertionType(delta, pxPerBp) === 'large' && labelFits) {
              // against whatever the label lands on: the bar when one was
              // drawn, else the block
              ctx.fillStyle = labelColor(
                barDrawn ? insertionColor : abgrToCssRgba(color),
              )
              ctx.textAlign = 'center'
              ctx.fillText(String(delta), xCenter, yMid)
            }
          } else {
            const left = Math.min(xa, xb)
            const width = Math.abs(xb - xa)
            ctx.fillStyle = DELETION_LINE_COLOR
            ctx.fillRect(
              left,
              yMid - DELETION_LINE_H / 2,
              width,
              DELETION_LINE_H,
            )
            if (labelFits && width >= DELETION_LABEL_MIN_PX) {
              // the label sits above the line, so it reads against the block
              ctx.fillStyle = labelColor(abgrToCssRgba(color))
              ctx.textAlign = 'center'
              // the magnitude, not the signed delta: a bare "-9048" reads as a
              // sequence length that went negative, and the glyph already says
              // which direction this is
              ctx.fillText(String(-delta), left + width / 2, yMid - h / 4)
            }
          }
        },
      )
    },
  )
}
