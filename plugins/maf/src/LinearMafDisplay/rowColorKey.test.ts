import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'

import { createMafTestEnvironment } from './testEnv.ts'

function loaded(rowColor?: string) {
  const { display, view } = createMafTestEnvironment({
    displayConfig: rowColor ? { rowColor } : {},
  }).createDisplay()
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.setSamples({
    samples: [
      { id: 'hg38', label: 'Human', color: '#aa0000' },
      { id: 'panTro4', label: 'Chimp' },
    ],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  return display
}

const rowColorKey = (display: ReturnType<typeof loaded>) =>
  display.legendSpec.sections.find(s => s.id === 'rowColor')?.items ?? []

it('keys nothing by name, whose labels are the key', () => {
  const display = loaded()
  expect(display.rowColorScales).toEqual([])
  expect(rowColorKey(display)).toEqual([])
})

it('keys a row attribute, and a click focuses its rows', () => {
  const display = loaded('label')
  expect(rowColorKey(display)).toEqual([
    { value: 'Human', label: 'Human', color: rowPaletteColorAt(0) },
    { value: 'Chimp', label: 'Chimp', color: rowPaletteColorAt(1) },
  ])
  expect(display.hasLegendKey).toBe(true)
  display.focusLegendEntry('rowColor', 'Chimp')
  expect(display.rowFocus).toEqual(['panTro4'])
})
