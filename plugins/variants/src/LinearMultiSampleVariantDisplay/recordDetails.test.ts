import { enrichFeatureFromClick } from './components/enrichFeatureFromClick.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

// The cell payload carries a record's span and genotype codes, no INFO, so a
// click asks the adapter for the record as LinearBasicDisplay's
// `fetchFullFeature` does, over the record's own span.
function adapterRecord(id: string) {
  return {
    uniqueId: id,
    refName: 'ctgA',
    start: 19508,
    end: 40130,
    INFO: { CLNSIG: ['Pathogenic'], AF: [0.012] },
  }
}

function stubDetails(mockRpcCall: jest.Mock, answer: (id: string) => unknown) {
  mockRpcCall.mockImplementation(
    (_sid: string, method: string, args: { featureId: string }) =>
      method === 'GetBasicFeatureDetails'
        ? Promise.resolve({ feature: answer(args.featureId) })
        : new Promise(() => {}),
  )
}

test('a record click reads the record with its INFO off the adapter', async () => {
  const { display, mockRpcCall } = recordsDisplayAt(KIT, 51)
  stubDetails(mockRpcCall, adapterRecord)
  // what the band's `enrich` hands a click: the record, no sample
  const clicked = enrichFeatureFromClick(
    display.featureById('>7494>7499')!,
    display.featureInfoById('>7494>7499'),
  )
  const full = await display.fetchFullRecord(clicked)
  expect(full.get('INFO')).toEqual({ CLNSIG: ['Pathogenic'], AF: [0.012] })
  const [, , args] = mockRpcCall.mock.calls.find(
    ([, method]) => method === 'GetBasicFeatureDetails',
  )!
  expect(args).toMatchObject({
    featureId: '>7494>7499',
    region: { refName: 'ctgA', start: 19508, end: 40130 },
  })
})

test('a genotype cell click keeps its sample card over the full record', async () => {
  const { display, mockRpcCall } = recordsDisplayAt(KIT, 51)
  stubDetails(mockRpcCall, adapterRecord)
  const clicked = enrichFeatureFromClick(
    display.featureById('>7494>7499')!,
    display.featureInfoById('>7494>7499'),
    { sampleName: 'S0', genotype: '0|1', alleles: 'A|T' },
  )
  const full = await display.fetchFullRecord(clicked)
  expect(full.get('INFO')).toEqual({ CLNSIG: ['Pathogenic'], AF: [0.012] })
  expect(full.get('clickedSample')).toBe('S0')
  expect(full.get('clickedGenotype')).toBe('0|1')
})

test('a record the adapter does not find opens as clicked', async () => {
  const { display, mockRpcCall } = recordsDisplayAt(KIT, 51)
  stubDetails(mockRpcCall, () => undefined)
  const clicked = display.featureById('>7494>7499')!
  expect(await display.fetchFullRecord(clicked)).toBe(clicked)
})
