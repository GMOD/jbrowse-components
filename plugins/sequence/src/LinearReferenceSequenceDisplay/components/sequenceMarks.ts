import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import {
  bpProjection,
  projectBp,
  spanLeft,
} from '@jbrowse/render-core/canvas2dUtils'
import {
  defineMark,
  makeAbgrFill,
  withPassId,
} from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/sequenceCell.generated.ts'

import type { SequenceCellChannels, SequenceCells } from './sequenceCells.ts'
import type { BpProjection } from '@jbrowse/render-core/canvas2dUtils'
import type { MarkFrame, MarkShape } from '@jbrowse/render-core/marks'

export const BORDER_COLOR = 'rgb(85,85,85)'
const BORDER_ABGR = cssColorToABGR(BORDER_COLOR)

// What each fill reaches past its edge toward the next cell painted, closing the
// hairline two antialiased fillRects leave where abutting cells of different
// colors meet on a fractional pixel; the next cell then paints over it, so the
// overdraw goes left on a reversed block. Same-colored neighbours are painted
// as one run. The GPU tiles exactly and needs neither.
const SEAM_PX = 0.4

export interface SequenceMarkState extends MarkFrame {
  rowHeight: number
  showLetters: boolean
}

export interface SequenceCellParams {
  rowHeight: number
  showBorders: boolean
}

interface CellBox {
  left: number
  width: number
}

function placeSpan(g: BpProjection, x: number, x2: number, box: CellBox) {
  const xa = projectBp(g, x)
  const xb = projectBp(g, x2)
  box.width = Math.abs(xb - xa)
  box.left = spanLeft(xa, xb, box.width)
}

export const sequenceCellShape: MarkShape<
  SequenceCellChannels,
  SequenceCellParams
> = {
  id: 'sequenceCell',
  pass: {
    ...slangPass({ id: 'sequenceCell', mod: shader }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, p) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      viewportWidth: clip.scissorW,
      zero: 0,
      rowHeight: p.rowHeight,
      showBorders: p.showBorders ? 1 : 0,
      borderColor: BORDER_ABGR,
    })
  },

  paintBlock(ctx, c, block, _frame, { rowHeight, showBorders }) {
    const g = bpProjection(block)
    const box = { left: 0, width: 0 }
    const setFill = makeAbgrFill(ctx)
    const seamLeft = block.reversed ? SEAM_PX : 0
    for (let i = 0; i < c.count;) {
      const color = c.color[i]!
      const row = c.row[i]!
      let j = i + 1
      while (
        j < c.count &&
        c.color[j] === color &&
        c.row[j] === row &&
        c.x[j] === c.x2[j - 1]
      ) {
        j++
      }
      placeSpan(g, c.x[i]!, c.x2[j - 1]!, box)
      setFill(color)
      ctx.fillRect(
        box.left - seamLeft,
        row * rowHeight,
        box.width + SEAM_PX,
        rowHeight,
      )
      i = j
    }
    if (showBorders) {
      ctx.strokeStyle = BORDER_COLOR
      ctx.lineWidth = shader.CELL_BORDER_PX
      for (let i = 0; i < c.count; i++) {
        if (c.bordered[i]) {
          placeSpan(g, c.x[i]!, c.x2[i]!, box)
          ctx.strokeRect(box.left, c.row[i]! * rowHeight, box.width, rowHeight)
        }
      }
    }
  },

  ink(c, block, _frame, { rowHeight, showBorders }, i) {
    const box = { left: 0, width: 0 }
    placeSpan(bpProjection(block), c.x[i]!, c.x2[i]!, box)
    const top = c.row[i]! * rowHeight
    const half = showBorders && c.bordered[i] ? shader.CELL_BORDER_PX / 2 : 0
    const left = Math.max(half, block.reversed ? SEAM_PX : 0)
    const right = Math.max(half, block.reversed ? 0 : SEAM_PX)
    return {
      left: box.left - left,
      top: top - half,
      width: box.width + left + right,
      height: rowHeight + 2 * half,
    }
  },
}

export const cellParams = (s: SequenceMarkState): SequenceCellParams => ({
  rowHeight: s.rowHeight,
  showBorders: s.showLetters,
})

/** The forward and reverse base rows, a cell per base. */
export const BASE_MARK = defineMark({
  shape: withPassId(sequenceCellShape, 'sequenceBase'),
  channels: (d: SequenceCells) => d.bases,
  params: cellParams,
})

/** The translation rows, a cell per codon plus each row's partial edge codons. */
export const CODON_MARK = defineMark({
  shape: withPassId(sequenceCellShape, 'sequenceCodon'),
  channels: (d: SequenceCells) => d.codons,
  params: cellParams,
})

export const SEQUENCE_MARKS = [BASE_MARK, CODON_MARK]
