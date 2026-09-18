import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

const SOURCES = [
  { name: 'HG001', population: 'EUR', super_pop: 'EUR' },
  { name: 'HG002', population: 'AFR', super_pop: 'AFR' },
]

function colored() {
  const { display } = createTestEnvironment().createDisplay()
  display.setRowColor('population')
  display.setSources(SOURCES)
  return display
}

// `layout` holds only what a user or a clustering run did, so the mixin's plain
// `layout.length > 0` answers for these displays too. Both channels used to
// seed `layout` on first load, which offered "Reset row order" on every
// population-colored track before anyone had touched it.
test('a configured colorBy writes no layout and is not a custom row order', () => {
  const display = colored()
  expect(display.layout).toHaveLength(0)
  expect(display.rowOrderIsCustom).toBe(false)
  expect(display.sources.every(s => s.labelColor)).toBe(true)
})

test('a configured facet writes no layout and is not a custom row order', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setFacet('population')
  display.setSources(SOURCES)

  expect(display.layout).toHaveLength(0)
  expect(display.rowOrderIsCustom).toBe(false)
  expect(display.sources.map(s => s.name)).toEqual(['HG002', 'HG001'])
})

// The palette is a pure function of the attribute, so persisting it bought
// nothing and cost every session a row table it had to carry and re-merge.
test('a session snapshot after setColorBy carries no palette colors', () => {
  const display = colored()
  expect(getSnapshot(display).layout).toBeUndefined()
})

test('a reorder is custom, and the reset clears it', () => {
  const display = colored()
  display.setLayout([...display.sources].reverse())
  expect(display.rowOrderIsCustom).toBe(true)

  display.clearLayout()

  expect(display.rowOrderIsCustom).toBe(false)
  expect(display.sources.map(s => s.name)).toEqual(['HG001', 'HG002'])
})

test('a second color-by still writes no layout', () => {
  const display = colored()
  display.setRowColor('super_pop')

  expect(display.layout).toHaveLength(0)
  expect(display.rowOrderIsCustom).toBe(false)
})
