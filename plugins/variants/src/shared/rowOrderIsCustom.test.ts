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

// `rows` holds only what a reader or a clustering run did, so the tint and the
// band leave it alone. Both channels used to seed the order on first load,
// which offered "Reset row order" on every population-colored track before
// anyone had touched it.
test('a configured colorBy writes no order and is not a custom row order', () => {
  const display = colored()
  expect(display.rowDomain).toEqual([])
  expect(display.rowArrangementIsCustom).toBe(false)
  expect(display.sources.every(s => s.labelColor)).toBe(true)
})

test('a configured facet writes no order and is not a custom row order', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setFacet('population')
  display.setSources(SOURCES)

  expect(display.rowDomain).toEqual([])
  expect(display.rowArrangementIsCustom).toBe(false)
  expect(display.sources.map(s => s.name)).toEqual(['HG002', 'HG001'])
})

// The palette is a pure function of the attribute, so persisting it would buy
// nothing and cost every session a row table it had to carry.
test('the config after setColorBy carries no palette colours', () => {
  const display = colored()
  expect(getSnapshot(display.configuration).rows).toBeUndefined()
  expect(getSnapshot(display.configuration).rowColor).toEqual({
    field: 'population',
  })
})

test('a reorder is custom, and the reset clears it', () => {
  const display = colored()
  display.setRowOrder([...display.sources].reverse())
  expect(display.rowArrangementIsCustom).toBe(true)

  display.resetRowArrangement()

  expect(display.rowArrangementIsCustom).toBe(false)
  expect(display.sources.map(s => s.name)).toEqual(['HG001', 'HG002'])
})

test('a second color-by still writes no order', () => {
  const display = colored()
  display.setRowColor('super_pop')

  expect(display.rowDomain).toEqual([])
  expect(display.rowArrangementIsCustom).toBe(false)
})
