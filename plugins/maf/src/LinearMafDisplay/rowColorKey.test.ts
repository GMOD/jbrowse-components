import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'

import { createMafTestEnvironment } from './testEnv.ts'

function loaded(color?: string) {
  const { display, view } = createMafTestEnvironment({
    displayConfig: color ? { rows: { color } } : {},
  }).createDisplay()
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  display.setSamples({
    samples: [
      { name: 'hg38', label: 'Human', color: '#aa0000' },
      { name: 'panTro4', label: 'Chimp' },
    ],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  return display
}

const rowColorKey = (display: ReturnType<typeof loaded>) =>
  display.legendSpec.sections.find(s => s.id === 'rows.color')?.items ?? []

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
  display.focusLegendEntry('rows.color', 'Chimp')
  expect(display.rowFocus).toEqual(['panTro4'])
})
