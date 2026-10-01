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

// What each fill reaches past its right edge on Canvas2D, closing the hairline
// two antialiased fillRects leave where abutting cells meet on a fractional
// pixel. The GPU tiles exactly and needs none.
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

function placeCell(
  c: SequenceCellChannels,
  g: BpProjection,
  i: number,
  box: CellBox,
) {
  const xa = projectBp(g, c.x[i]!)
  const xb = projectBp(g, c.x2[i]!)
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
    for (let i = 0; i < c.count; i++) {
      placeCell(c, g, i, box)
      setFill(c.color[i]!)
      ctx.fillRect(
        box.left,
        c.row[i]! * rowHeight,
        box.width + SEAM_PX,
        rowHeight,
      )
    }
    if (showBorders) {
      ctx.strokeStyle = BORDER_COLOR
      ctx.lineWidth = shader.CELL_BORDER_PX
      for (let i = 0; i < c.count; i++) {
        if (c.bordered[i]) {
          placeCell(c, g, i, box)
          ctx.strokeRect(box.left, c.row[i]! * rowHeight, box.width, rowHeight)
        }
      }
    }
  },

  ink(c, block, _frame, { rowHeight, showBorders }, i) {
    const box = { left: 0, width: 0 }
    placeCell(c, bpProjection(block), i, box)
    const top = c.row[i]! * rowHeight
    const half = showBorders && c.bordered[i] ? shader.CELL_BORDER_PX / 2 : 0
    return {
      left: box.left - half,
      top: top - half,
      width: box.width + half + Math.max(SEAM_PX, half),
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
