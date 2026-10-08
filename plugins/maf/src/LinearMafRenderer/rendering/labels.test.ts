import { resolvePalette } from '@jbrowse/core/ui/palette'

import { getMafColorPalette, getMafLabelColors } from '../util.ts'
import { drawMafLabels } from './labels.ts'

import type { VisibleLabel } from '../../LinearMafDisplay/components/computeVisibleLabels.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

function fillOf(label: VisibleLabel, mode: 'light' | 'dark') {
  const palette = resolvePalette({ configTheme: { palette: { mode } } })
  let fill = ''
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillText() {
      fill = this.fillStyle
    },
  }
  drawMafLabels(ctx as unknown as Ctx2D, [label], getMafLabelColors(palette))
  return { fill, palette }
}

test.each(['light', 'dark'] as const)(
  'an IUPAC letter reads against its unknown-base cell (%s)',
  mode => {
    const { fill, palette } = fillOf(
      { x: 0, y: 0, text: 'R', lowerBase: 'r', onBase: true },
      mode,
    )
    expect(fill).not.toBe(getMafColorPalette(palette).unknownBaseColor)
  },
)

test('a letter over a match cell takes the neutral text color', () => {
  const { fill, palette } = fillOf(
    { x: 0, y: 0, text: 'A', lowerBase: 'a', onBase: false },
    'light',
  )
  expect(fill).toBe(palette.text.primary)
})
