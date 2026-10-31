import { featureInfoOf } from '../shared/cellDataFixtures.ts'
import { buildRecordHit } from './components/buildVariantHit.ts'
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

// A records-band hover names a record and no row, so the tooltip is the
// record's fields with nothing merged in: one hover slot serves both bands.
test('a record hover reports the record with no row merged in', () => {
  const display = displayWithSamples()
  display.setHoveredFeature(
    buildRecordHit({ info: featureInfoOf('rs123'), featureId: 'v0' }),
  )
  expect(display.hoveredTooltipSource).toMatchObject({
    featureName: 'rs123',
    genotype: '',
  })
  expect(display.hoveredTooltipSource).not.toHaveProperty('population')
})
