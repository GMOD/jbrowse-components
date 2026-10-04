import { resolvePalette } from '@jbrowse/core/ui/palette'
import { getPaletteHost } from '@jbrowse/core/util'

import { createTestAlignmentsDisplay } from './testUtils.ts'

import type { LegendSpec } from '@jbrowse/core/ui/legendSpec'

const readSwatches = (spec: LegendSpec) =>
  spec.sections.find(s => s.id === 'reads')!.items.map(i => i.color)

// The read fills are the theme's, so the SVG export, whose theme need not be
// the session's, keys them in its own; the screen keys the session's.
test('the key follows the theme it is asked for', () => {
  const { display } = createTestAlignmentsDisplay()
  display.setShowLegend(true)
  const session = getPaletteHost(display).palette
  const other = resolvePalette({
    mode: session.mode === 'dark' ? 'light' : 'dark',
  })

  expect(display.legendSpecIn(session)).toEqual(display.legendSpec)
  expect(readSwatches(display.legendSpecIn(other))).not.toEqual(
    readSwatches(display.legendSpec),
  )
})
