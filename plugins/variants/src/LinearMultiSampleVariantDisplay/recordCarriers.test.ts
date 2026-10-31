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

function cellData(
  codes: number[],
  svType = 'DEL',
  alt = ['<DEL>'],
  svAlleles = [true],
) {
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
            alt,
            svAlleles,
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

test('a sample counts once, whatever it carries, and a no-call still counts', () => {
  expect(
    countRecordCarriers(cellData([1, 2, 3, 4]), SAMPLES).get('sv1'),
  ).toEqual({ carriers: 2, nonCarriers: 1, noCall: 1 })
})

// An un-decomposed site: ALT1 a 2 bp change, ALT2 the deletion that makes
// the record an SV. Calling ALT1 alone does not carry the deletion.
test('only the structural alleles carry a multi-allelic SV record', () => {
  const counted = countRecordCarriers(
    cellData([2, 5, 3, 4], 'DEL', ['TT', '<DEL>'], [false, true]),
    SAMPLES,
  ).get('sv1')
  expect(counted).toEqual({ carriers: 1, nonCarriers: 2, noCall: 1 })
})

test('a record with no SV class is not counted', () => {
  expect(countRecordCarriers(cellData([1, 1, 1, 1], ''), SAMPLES).size).toBe(0)
})

// HGSV_1823 at RHD: 538 carriers, 1 non-carrier and 2,663 no-calls of 3,202
const HGSV_1823 = { carriers: 538, nonCarriers: 1, noCall: 2663 }

test('the share is of every shown sample, no-calls included', () => {
  expect(carrierPercent(HGSV_1823)).toBe('17%')
  expect(carrierPercent({ carriers: 1, nonCarriers: 3201, noCall: 0 })).toBe(
    '<1%',
  )
  expect(carrierPercent({ carriers: 0, nonCarriers: 3202, noCall: 0 })).toBe(
    '0%',
  )
})

test('the tooltip breaks the samples down', () => {
  const rows = getTooltipRows(
    buildRecordHit({
      info: featureInfoOf('sv1', { svType: 'DEL' }),
      featureId: 'sv1',
      carriers: HGSV_1823,
    }),
  )
  expect(rows.find(r => r.key === 'carriers')).toEqual({
    key: 'carriers',
    label: 'Carriers',
    value: '538 of 3,202 samples (17%); 1 non-carrier, 2,663 no-call',
  })
  expect(carrierSummary({ carriers: 969, nonCarriers: 2233, noCall: 0 })).toBe(
    '969 of 3,202 samples (30%); 2,233 non-carriers',
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
  expect(labelOf(display)).toBe('sv1 <DEL> 7Kbp 50%')

  // a row filter is a fetch input, which drops the payload until it lands
  display.setRowFocus(['S0', 'S1', 'S2'])
  display.setCellData(cellData([1, 2, 3, 4]), [0])
  expect(display.recordCarrierSamples).toEqual(['S0', 'S1', 'S2'])
  expect(labelOf(display)).toBe('sv1 <DEL> 7Kbp 67%')
})

test('haplotype rows count their sample once', () => {
  const display = recordsDisplay()
  display.setUnit('haplotype')
  display.setCellData(cellData([1, 2, 3, 4]), [0])
  expect(display.sources.length).toBe(8)
  expect(display.recordCarrierSamples).toEqual(SAMPLES)
  expect(display.recordCarriers.get('sv1')).toEqual({
    carriers: 2,
    nonCarriers: 1,
    noCall: 1,
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
