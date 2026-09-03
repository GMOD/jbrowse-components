import { createTestEnvironment } from '../LinearMultiSampleVariantDisplay/testEnv.ts'
import { buildVariantLaneHit } from './buildVariantHit.ts'

import type { VariantFeatureInfo } from './types.ts'

const info: VariantFeatureInfo = {
  ref: 'A',
  alt: ['T'],
  name: 'rs123',
  description: 'SNV',
  length: 1,
  insertedBp: 0,
  type: 'SNV',
  genotypeCodes: new Uint32Array(),
}

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

// The variant lane's hover names a RECORD, so there is no row to merge from —
// `buildVariantLaneHit` leaves `name` empty for exactly this reason, and the
// tooltip is the record's own fields. One hover slot serves both bands, so the
// lane needs no second tooltip channel and inherits the viewport-change clear
// (see clearHover.test.ts).
test('a variant-lane hover reports the record with no row merged in', () => {
  const display = displayWithSamples()
  display.setHoveredFeature(buildVariantLaneHit({ info, featureId: 'v0' }))
  expect(display.hoveredTooltipSource).toMatchObject({
    featureName: 'rs123',
    alleles: 'A > T',
    genotype: '',
  })
  expect(display.hoveredTooltipSource).not.toHaveProperty('population')
})
