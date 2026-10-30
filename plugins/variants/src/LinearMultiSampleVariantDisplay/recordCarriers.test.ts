import {
  cellDataOf,
  cellPayloadOf,
  featureInfoOf,
} from '../shared/cellDataFixtures.ts'
import { buildRecordHit } from './components/buildVariantHit.ts'
import { getTooltipRows } from './components/getTooltipRows.ts'
import {
  carrierPercent,
  carrierSummary,
  countRecordCarriers,
} from './recordCarriers.ts'
import { createTestEnvironment } from './testEnv.ts'

const SAMPLES = ['S0', 'S1', 'S2', 'S3']
// S0 carries on both haplotypes, S1 on one, S2 is reference, S3 a no-call
const DICT = ['1|1', '0|1', '0|0', '.|.', '0/2']

function cellData(codes: number[], svType = 'DEL') {
  return cellDataOf({
    samplePloidy: Object.fromEntries(SAMPLES.map(s => [s, 2])),
    rowNames: SAMPLES,
    sampleNames: SAMPLES,
    genotypeDict: DICT,
    simplifiedFeatures: [
      {
        id: 'sv1',
        data: { start: 1000, end: 8000, refName: 'ctgA', name: 'sv1' },
      },
    ],
    perRegionCellData: {
      0: cellPayloadOf(
        [
          featureInfoOf('sv1', {
            svType,
            description: '<DEL> 7Kbp',
            length: 7000,
            genotypeCodes: Uint32Array.from(codes),
          }),
        ],
        { featurePositions: Uint32Array.from([1000, 8000]) },
      ),
    },
  })
}

test('a sample counts once, whatever it carries, and a no-call leaves the denominator', () => {
  expect(
    countRecordCarriers(cellData([1, 2, 3, 4]), SAMPLES).get('sv1'),
  ).toEqual({
    carriers: 2,
    called: 3,
    noCall: 1,
  })
})

test('a sample carrying another alt allele carries the record', () => {
  expect(
    countRecordCarriers(cellData([5, 3, 3, 3]), SAMPLES).get('sv1')?.carriers,
  ).toBe(1)
})

test('a record with no SV class is not counted', () => {
  expect(countRecordCarriers(cellData([1, 1, 1, 1], ''), SAMPLES).size).toBe(0)
})

test('the share rounds to a whole percent, a rare carrier to <1%', () => {
  expect(carrierPercent({ carriers: 1312, called: 3202, noCall: 0 })).toBe(
    '41%',
  )
  expect(carrierPercent({ carriers: 1, called: 3202, noCall: 0 })).toBe('<1%')
  expect(carrierPercent({ carriers: 0, called: 3202, noCall: 0 })).toBe('0%')
})

test('the tooltip names the carriers out of the samples called', () => {
  const info = featureInfoOf('sv1', { svType: 'DEL' })
  const rows = getTooltipRows(
    buildRecordHit({
      info,
      featureId: 'sv1',
      carriers: { carriers: 1312, called: 3202, noCall: 7 },
    }),
  )
  expect(rows.find(r => r.key === 'carriers')).toEqual({
    key: 'carriers',
    label: 'Carriers',
    value: '1,312 of 3,202 samples (41%), 7 no-call',
  })
  expect(carrierSummary({ carriers: 1312, called: 3202, noCall: 0 })).toBe(
    '1,312 of 3,202 samples (41%)',
  )
})

function recordsDisplay() {
  const env = createTestEnvironment({
    displayConfig: { records: { show: true } },
  }).createDisplay()
  env.display.view.setWidth(1000)
  env.display.view.setNewView(10, 0)
  env.display.setSources(SAMPLES.map(name => ({ name })))
  env.display.setCellData(cellData([1, 2, 3, 4]), [0])
  return env.display
}

function labelOf(display: ReturnType<typeof recordsDisplay>) {
  return display.recordsLaidOutDataMap.get(0)!.floatingLabelsData.get('sv1')
    ?.nameLabel?.text
}

test('the label ends with the share of the samples shown as rows', () => {
  const display = recordsDisplay()
  expect(labelOf(display)).toBe('sv1 <DEL> 7Kbp 67%')

  // a row filter is a fetch input, which drops the payload until it lands
  display.setRowFocus(['S0', 'S2'])
  display.setCellData(cellData([1, 2, 3, 4]), [0])
  expect(display.recordCarrierSamples).toEqual(['S0', 'S2'])
  expect(labelOf(display)).toBe('sv1 <DEL> 7Kbp 50%')
})

test('haplotype rows count their sample once', () => {
  const display = recordsDisplay()
  display.setUnit('haplotype')
  display.setCellData(cellData([1, 2, 3, 4]), [0])
  expect(display.sources.length).toBe(8)
  expect(display.recordCarrierSamples).toEqual(SAMPLES)
  expect(display.recordCarriers.get('sv1')).toMatchObject({
    carriers: 2,
    called: 3,
  })
})

test('a reorder recounts nothing', () => {
  const display = recordsDisplay()
  const counted = display.recordCarriers
  const samples = display.recordCarrierSamples
  display.setRowOrder([...SAMPLES].reverse().map(name => ({ name })))
  expect(display.recordCarrierSamples).toBe(samples)
  expect(display.recordCarriers).toBe(counted)
})
