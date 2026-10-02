import { getGeneticCode } from '@jbrowse/core/util/geneticCodes'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { baseCell, codonCell } from './sequenceCells.ts'
import {
  baseRowComplemented,
  frameShiftBounds,
  rowLayout,
  visibleCodonRange,
  visibleRange,
} from './sequenceGeometry.ts'

import type { SequenceRegionData } from '../model.ts'
import type { SequenceRenderState } from './sequenceGeometry.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The screen x of the middle of the `bpWidth`-bp span starting at `startBp`.
 * Orientation only mirrors the span, so its middle is the mapper at its middle
 * on both.
 */
function centerMapper(block: RenderBlock) {
  const toX = makeBpMapper(block)
  return (startBp: number, bpWidth: number) => toX(startBp + bpWidth / 2)
}

/**
 * The base and amino-acid letters over the cells the marks paint, in each
 * cell's contrast colour. Painted only once a base is wide enough to read
 * (`showLetters`), and only over the visible part of each block.
 */
export function drawSequenceLetters(
  ctx: Ctx2D,
  sequenceData: ReadonlyMap<number, SequenceRegionData>,
  blocks: RenderBlock[],
  state: SequenceRenderState,
) {
  const { showLetters, isDna, rowHeight, palette } = state
  if (!showLetters) {
    return
  }
  // floored at 1px: below that the font string is invalid and the context
  // keeps whatever font it had
  ctx.font = `${Math.max(1, Math.min(rowHeight - 2, 14))}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  forEachClippedBlock(
    ctx,
    blocks,
    state.canvasWidth,
    state.canvasHeight,
    block => sequenceData.get(block.displayedRegionIndex),
    ({ seq, start: seqStart, geneticCodeId }, block) => {
      const center = centerMapper(block)
      const codonTable = getGeneticCode(geneticCodeId).codonTable
      for (const [slot, row] of rowLayout(state, block.reversed).entries()) {
        const y = slot * rowHeight + rowHeight / 2
        if (row.type === 'base') {
          const complemented = baseRowComplemented(
            row.strand,
            block.reversed,
            isDna,
          )
          const { start, end } = visibleRange(
            block.start,
            block.end,
            seqStart,
            seq.length,
          )
          for (let i = start; i < end; i++) {
            const { letter, color } = baseCell(
              seq[i]!,
              complemented,
              isDna,
              palette,
            )
            ctx.fillStyle = color.text
            ctx.fillText(letter, center(seqStart + i, 1), y)
          }
        } else {
          const { frameShift, sliceEnd } = frameShiftBounds(
            seq,
            seqStart,
            row.frame,
          )
          const { start, end } = visibleCodonRange(
            block.start,
            block.end,
            seqStart,
            seq.length,
            frameShift,
            sliceEnd,
          )
          for (let i = start; i < end; i += 3) {
            const { aminoAcid, color } = codonCell(
              seq,
              i,
              row.frame,
              codonTable,
              palette,
            )
            ctx.fillStyle = color.text
            ctx.fillText(aminoAcid, center(seqStart + i, 3), y)
          }
        }
      }
    },
  )
}
