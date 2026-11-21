import { featureInfoOf } from '../shared/cellData.fixture.ts'
import { buildRecordHit } from './components/buildVariantHit.ts'
import { createTestEnvironment } from './testEnv.ts'

function displayWithSamples() {
  const { display } = createTestEnvironment({
    displayConfig: { genotypes: { show: true } },
  }).createDisplay()
  display.setSources([{ name: 'HG002', population: 'EUR' }])
  return display
}

// The genotype cells' hover: the row's sample metadata rides beside the
// record's fields, which is what puts a `samplesTsv` column in the tooltip.
test('a genotype hover carries the hovered rows metadata', () => {
  const display = displayWithSamples()
  display.setHoveredFeature({ genotype: '0|1', name: 'HG002' })
  expect(display.hoveredTooltipSource).toMatchObject({
    genotype: '0|1',
    sample: { population: 'EUR' },
  })
})

// A samplesTsv column may share a name with a cell field; both reach the
// tooltip, the cell's under its field and the sample's as its own row.
test('a sample column named like a cell field still shows as its own row', () => {
  const { display } = createTestEnvironment({
    displayConfig: { genotypes: { show: true } },
  }).createDisplay()
  display.setSources([{ name: 'HG002', description: 'proband' }])
  expect(
    display.tooltipTextOf({
      genotype: '0|1',
      name: 'HG002',
      description: 'SNV',
    }),
  ).toBe('HG002\nGenotype: 0|1\nDescription: SNV\nDescription: proband')
})

// A records-band hover names a record and no row, so the tooltip is the
// record's fields with no sample beside them: one hover slot serves both bands.
test('a record hover reports the record with no row merged in', () => {
  const display = displayWithSamples()
  display.setHoveredFeature(
    buildRecordHit({ info: featureInfoOf('rs123'), featureId: 'v0' }),
  )
  expect(display.hoveredTooltipSource).toMatchObject({
    featureName: 'rs123',
    genotype: '',
  })
  expect(display.hoveredTooltipSource?.sample).toBeUndefined()
})
