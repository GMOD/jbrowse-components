import {
  INSERTION_COLOR,
  MIN_HEIGHT_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
  insertionBarWidth,
} from '@jbrowse/alignments-core'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import {
  isFeatureColorHidden,
  resolveLocalRowIndices,
} from './resolveLocalRowIndices.ts'
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
) {
  const {
    canvasWidth,
    canvasHeight,
    rowHeight,
    rowProportion,
    rowIndexByValue,
    rowColorsByIndex,
    hiddenColors,
  } = state
  const { height: h, offset } = rowBand(rowHeight, rowProportion)
  ctx.font = FONT
  ctx.textBaseline = 'middle'

  forEachClippedBlock(
    ctx,
    renderBlocks,
    canvasWidth,
    canvasHeight,
    block => {
      const data = regions.get(block.displayedRegionIndex)
      // Length 0 is the slot-unset signal, not an empty region — see
      // `featureDeltas` in the RPC result type.
      return data?.featureDeltas.length === data?.featureStarts.length
        ? data
        : undefined
    },
    (regionData, renderBlock) => {
      const bpToPx = makeBpMapper(renderBlock)
      const {
        featureStarts,
        featureEnds,
        featureDeltas,
        featureColors,
        partitionValues,
        featurePartitionIndex,
      } = regionData
      const rowForLocal = resolveLocalRowIndices(
        partitionValues,
        rowIndexByValue,
      )
      // Exact for this block rather than the view's global bpPerPx, which is what
      // the bar-width and label-fit thresholds are calibrated against.
      const pxPerBp =
        (renderBlock.screenEndPx - renderBlock.screenStartPx) /
        (renderBlock.end - renderBlock.start)
      const labelFits = h >= MIN_HEIGHT_FOR_TEXT

      for (let i = 0; i < featureStarts.length; i++) {
        const delta = featureDeltas[i]!
        const rowIndex = rowForLocal[featurePartitionIndex[i]!]
        if (
          delta !== 0 &&
          rowIndex !== undefined &&
          !isFeatureColorHidden(
            rowIndex,
            featureColors[i]!,
            hiddenColors,
            rowColorsByIndex,
          )
        ) {
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
            if (barWidth > Math.abs(xb - xa)) {
              ctx.fillStyle = INSERTION_COLOR
              drawInsertionMarker(ctx, xCenter, top, h, delta, pxPerBp)
            }
            if (getInsertionType(delta, pxPerBp) === 'large' && labelFits) {
              ctx.fillStyle = 'white'
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
            if (labelFits && width >= 30) {
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
        }
      }
    },
  )
}
