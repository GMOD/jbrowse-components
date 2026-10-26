import { createTestEnvironment } from './testEnv.ts'

function displayWithSamples() {
  const { display } = createTestEnvironment().createDisplay()
  display.setSources([{ name: 'HG002', population: 'EUR' }])
  return display
}

// The genotype cells' hover: the row's metadata attributes ride in under the
// record's fields, which is what puts a `samplesTsv` column in the tooltip.
test('a genotype hover merges the hovered rows metadata in', () => {
  const display = displayWithSamples()
  display.setHoveredFeature({ genotype: '0|1', name: 'HG002' })
  expect(display.hoveredTooltipSource).toMatchObject({
    genotype: '0|1',
    population: 'EUR',
  })
})
