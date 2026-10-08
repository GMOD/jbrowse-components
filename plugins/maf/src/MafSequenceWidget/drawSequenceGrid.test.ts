import { resolvePalette } from '@jbrowse/core/ui/palette'

import {
  getMafColorPalette,
  getMafLabelColors,
} from '../LinearMafRenderer/util.ts'
import { drawSequenceGrid } from './drawSequenceGrid.ts'

function paint(
  sequence: string,
  colorBackground: boolean,
  mode: 'light' | 'dark',
) {
  const palette = resolvePalette({ configTheme: { palette: { mode } } })
  const cells: string[] = []
  const letters: string[] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textBaseline: '',
    fillRect(x: number, _y: number, w: number) {
      if (w < 100) {
        cells[x / w] = this.fillStyle
      }
    },
    fillText() {
      letters.push(this.fillStyle)
    },
  }
  drawSequenceGrid({
    ctx: ctx as unknown as CanvasRenderingContext2D,
    sequences: [sequence],
    startRow: 0,
    endRow: 1,
    startCol: 0,
    endCol: sequence.length,
    width: 1000,
    height: 100,
    colorBackground,
    palette,
  })
  return { palette, cells, letters }
}

describe.each(['light', 'dark'] as const)('in the %s theme', mode => {
  it('fills each base the color the display fills it', () => {
    const { palette, cells } = paint('AcgTNX', true, mode)
    const { colorForBase, unknownBaseColor } = getMafColorPalette(palette)
    expect(cells).toEqual([
      colorForBase.a,
      colorForBase.c,
      colorForBase.g,
      colorForBase.t,
      colorForBase.n,
      unknownBaseColor,
    ])
  })

  it('letters a filled base the color the display letters it', () => {
    const { palette, letters } = paint('ANX', true, mode)
    const { forBase, unknownBase } = getMafLabelColors(palette)
    expect(letters).toEqual([forBase.a, forBase.n, unknownBase])
  })

  it('letters an unfilled base in its fill color', () => {
    const { palette, letters } = paint('ANX', false, mode)
    const { colorForBase, unknownBaseColor } = getMafColorPalette(palette)
    expect(letters).toEqual([colorForBase.a, colorForBase.n, unknownBaseColor])
  })
})
