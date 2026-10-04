import { rowPaletteColorAt } from '@jbrowse/core/ui/colors'

import { UNCOLORED_ROW } from './sourcesLogic.ts'
import { createTestEnvironment, makeSource } from './testEnv.ts'

import type { WiggleSourceData } from '@jbrowse/wiggle-core'

function makeDisplay(sources: WiggleSourceData[], { rows = false } = {}) {
  const { createDisplay } = createTestEnvironment()
  const { display, view } = createDisplay()
  display.setHeight(600)
  display.setRowLayout(rows)
  display.setRpcData(0, { sources }, view.displayedRegions[0])
  return display
}

const GROUPED = [
  { ...makeSource('a'), group: 'T cell' },
  { ...makeSource('b'), group: 'B cell' },
  { ...makeSource('c'), group: 'T cell' },
  { ...makeSource('d'), label: 'Monocyte' },
] as WiggleSourceData[]

function byGroup(display: ReturnType<typeof makeDisplay>) {
  display.applyRowEdits(display.editableSources, { field: 'group' })
}

const rowColorKey = (display: ReturnType<typeof makeDisplay>) =>
  display.legendSpec.sections.find(s => s.id === 'rowColor')?.items ?? []

it('keys each overlaid subtrack under its label in its palette colour', () => {
  const display = makeDisplay(GROUPED)
  expect(display.legendSpec.title).toBe('Subtrack')
  expect(rowColorKey(display)).toEqual([
    { value: 'a', label: 'a', color: rowPaletteColorAt(0) },
    { value: 'b', label: 'b', color: rowPaletteColorAt(1) },
    { value: 'c', label: 'c', color: rowPaletteColorAt(2) },
    { value: 'd', label: 'Monocyte', color: rowPaletteColorAt(3) },
  ])
})

it('keys nothing by name on stacked rows, and the groups once coloured by them', () => {
  const display = makeDisplay(GROUPED, { rows: true })
  expect(rowColorKey(display)).toEqual([])
  byGroup(display)
  expect(rowColorKey(display).map(i => i.label)).toEqual(['T cell', 'B cell'])
})

it('keys nothing in an overlay painting a score gradient', () => {
  const display = makeDisplay(GROUPED)
  display.setColor({ field: 'score', scale: 'linear', scheme: 'viridis' })
  expect(display.colorScales.map(s => s.id)).not.toContain('rowColor')
})

it('focuses the subtracks a key entry lists', () => {
  const display = makeDisplay(GROUPED, { rows: true })
  byGroup(display)
  display.focusLegendEntry('rowColor', 'T cell')
  expect(display.sources.map(s => s.name)).toEqual(['a', 'c'])
})

describe('a subtrack with no value of the colour field', () => {
  it('paints grey in an overlay beside the coloured ones', () => {
    const display = makeDisplay(GROUPED)
    byGroup(display)
    expect(display.markSources.map(s => s.color)).toEqual([
      rowPaletteColorAt(0),
      rowPaletteColorAt(1),
      rowPaletteColorAt(0),
      UNCOLORED_ROW,
    ])
  })

  it('keeps the plot colour on stacked rows', () => {
    const display = makeDisplay(GROUPED, { rows: true })
    byGroup(display)
    expect(display.markSources.at(-1)!.color).toBeUndefined()
  })
})
