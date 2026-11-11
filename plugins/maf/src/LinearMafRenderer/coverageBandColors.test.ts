import { resolvePalette } from '@jbrowse/core/ui/palette'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'

import { mafCoverageBandColors } from './coverageBandColors.ts'

function paletteIn(mode: 'light' | 'dark') {
  return resolvePalette({ configTheme: { palette: { mode } } })
}

test('the insertion indicator is the palette color in light mode and lighter in dark', () => {
  const light = paletteIn('light')
  const dark = paletteIn('dark')
  expect(mafCoverageBandColors(light).insertionIndicator).toBe(
    cssColorToABGR(light.insertion),
  )
  const raw = cssColorToABGR(dark.insertion)
  const drawn = mafCoverageBandColors(dark).insertionIndicator
  expect(drawn).not.toBe(raw)
  for (const shift of [0, 8, 16]) {
    expect((drawn >>> shift) & 0xff).toBeGreaterThanOrEqual(
      (raw >>> shift) & 0xff,
    )
  }
})
