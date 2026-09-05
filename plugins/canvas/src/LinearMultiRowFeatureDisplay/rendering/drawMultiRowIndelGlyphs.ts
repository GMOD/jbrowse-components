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

// A deletion line has to read against the block it crosses, and a block whose
// class palette says "deletion" is itself grey, so the theme's own `deletion`
// grey would vanish into it. Dark neutral instead.
const DELETION_LINE_COLOR = '#333'
const DELETION_LINE_H = 2
const FONT = '10px sans-serif'
// A deletion label needs this much block to sit inside without spilling past it.
const DELETION_LABEL_MIN_PX = 30

/**
 * Text color for a label drawn ON one of these blocks, by contrast against
 * whatever it lands on.
 *
 * Not a constant, because there is no color that reads on every block. Both bp
 * labels sit over the painting, and the painting's colors are the user's: an
 * `itemRgb` file's, a `sampleColorMap`, or — in the default configuration, which
 * is what the `lengthField` config example uses — `tagColorPalette`, every entry
 * of which is a pastel. A hardcoded white insertion count was therefore
 * invisible on exactly the pangenome-path track the glyphs were added for,
 * wherever the block was wide enough that the insertion bar wasn't drawn over
 * it. Alignments can hardcode white because its label always sits on the
 * purple bar; here that is the minority case.
 *
 * Memoized per background because `getContrastText` parses a color string, and
 * a painting repeats a handful of them across every block it has.
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
 * deltas the `lengthField` slot packs. Takes the same four arguments as
 * `drawMultiRowBlocks` and walks the same `forEachClippedBlock` + `makeBpMapper`
 * geometry, so a glyph always lands on the block it annotates; that sharing is
 * the point of the identical signature.
 *
 * A block's width can only express how much *reference* a feature covers, so an
 * insertion — which covers almost none — draws the same however large it is.
 * These glyphs are where the length goes: the insertion marker is the one
 * `plugins/alignments` and `plugins/maf` already draw (`drawInsertionMarker`
 * from `@jbrowse/alignments-core`, so the bar geometry can't drift from
 * theirs), and a deletion gets the line-across-the-span idiom from the same
 * vocabulary.
 *
 * `insertionColor` is passed in rather than imported for the same reason
 * `drawMafInsertions` and `drawVariantInsertionGlyphs` take it: the caller has
 * the theme and this does not. It must be `palette.insertion`, which is what
 * the pileup paints, not alignments-core's `INSERTION_COLOR` — that constant is
 * the theme-agnostic fallback in `DEFAULT_CIGAR_OP_DRAW_COLORS` for worker code
 * with no theme to read, and it is a different purple. Hardcoding it here meant
 * a custom theme moved the pileup and left these glyphs behind.
 *
 * Shared by the on-screen overlay and the SVG export. It is an overlay rather
 * than part of the Canvas2D block painter because the blocks may have been drawn
 * by the GPU backend, which this deliberately does not touch: a positioned mark
 * pass is cheap on the CPU at these feature counts and needs no shader.
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
      // Exact for this block rather than the view's global bpPerPx, which is what
      // the bar-width and label-fit thresholds are calibrated against.
      const pxPerBp = pxPerBpOf(renderBlock)
      const labelFits = h >= MIN_HEIGHT_FOR_TEXT

      forEachDrawnFeature(
        regionData,
        drawnFeatureContext(regionData, state),
        (i, rowIndex, color) => {
          const delta = featureDeltas[i]!
          if (delta === 0) {
            // a reference-length allele: no glyph, and the block already says
            // everything there is to say about it
            return
          }
          const xa = bpToPx(featureStarts[i]!)
          const xb = bpToPx(featureEnds[i]!)
          const top = offset + rowHeight * rowIndex
          const yMid = Math.round(top + h / 2)
          if (delta > 0) {
            // Centered on the block: unlike a read's interbase insertion, the
            // allele *replaces* this whole span, so it has no single boundary to
            // sit at.
            const xCenter = (xa + xb) / 2
            // The bar only earns a draw when it is wider than the block, which
            // is the pure-insertion case (a bubble with no reference span, 72 of
            // the 601 in the five-strain E. coli graph, drawn 1bp wide). Where
            // the block is already wider the block *is* the bar — same color,
            // same center — so drawing it again only overdraws, and what the
            // reader still lacks is the magnitude, i.e. the label below.
            const barWidth = insertionBarWidth(delta, pxPerBp, h)
            const barDrawn = barWidth > Math.abs(xb - xa)
            if (barDrawn) {
              ctx.fillStyle = insertionColor
              drawInsertionMarker(ctx, xCenter, top, h, delta, pxPerBp)
            }
            if (getInsertionType(delta, pxPerBp) === 'large' && labelFits) {
              // against whatever the label actually lands on — the bar when one
              // was drawn (it is wider than the block by definition of
              // `barDrawn`, so it is what is under the centered text), the
              // block itself when the block was the wider of the two
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
              // Sits above the line, so it is on the block — the line's own
              // #333 is chosen to read against a grey deletion-class block and
              // says nothing about the rest of the palette. Same resolver as
              // the insertion count, for the same reason.
              ctx.fillStyle = labelColor(abgrToCssRgba(color))
              ctx.textAlign = 'center'
              // The MAGNITUDE, not the signed delta. `delta` is negative here by
              // definition, and a bare "-9048" beside a graph reads as a
              // sequence length that went negative -- docs review hit exactly
              // that on the pangenome path figures. The glyph and the legend
              // already say which direction this is, and the alignments deletion
              // label this borrows its idiom from prints a positive gap length
              // too (computeVisibleLabels).
              ctx.fillText(String(-delta), left + width / 2, yMid - h / 4)
            }
          }
        },
      )
    },
  )
}
