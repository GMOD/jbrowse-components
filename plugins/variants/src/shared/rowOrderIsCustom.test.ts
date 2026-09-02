import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'

// A configured `colorBy` seeds `layout` on first load, so `layout.length` alone
// offered "Reset row order" on every population-colored track before anyone had
// touched it — and clicking it re-applied the same arrangement.
test('a configured arrangement alone is not a custom row order', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setColorBy('population')
  display.setSources([
    { name: 'HG001', population: 'EUR' },
    { name: 'HG002', population: 'AFR' },
  ])
  expect(display.layout.length).toBe(2)
  expect(display.rowOrderIsCustom).toBe(false)
})

test('a reorder away from the configured arrangement is custom', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setColorBy('population')
  display.setSources([
    { name: 'HG001', population: 'EUR' },
    { name: 'HG002', population: 'AFR' },
  ])
  display.setLayout([...display.layout].reverse())
  expect(display.rowOrderIsCustom).toBe(true)
  display.clearLayout()
  expect(display.rowOrderIsCustom).toBe(false)
})

// The second "Color by..." re-arranges the layout already on screen rather than
// adapter order, and that path merges through `getSources`, which stamps a
// `sampleName` the config-derived arrangement has no reason to carry.
test('a second color-by is still not a custom row order', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setColorBy('population')
  display.setSources([
    { name: 'HG001', population: 'EUR', super_pop: 'EUR' },
    { name: 'HG002', population: 'AFR', super_pop: 'AFR' },
  ])
  display.setColorBy('super_pop')
  expect(display.rowOrderIsCustom).toBe(false)
})

test('with nothing configured any written layout is custom', () => {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources([{ name: 'HG001' }, { name: 'HG002' }])
  expect(display.rowOrderIsCustom).toBe(false)
  display.setLayout([{ name: 'HG002' }, { name: 'HG001' }])
  expect(display.rowOrderIsCustom).toBe(true)
})
