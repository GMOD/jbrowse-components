import { isAbortException } from '@jbrowse/core/util/aborting'

import { enrichFeatureFromClick } from './components/enrichFeatureFromClick.ts'
import { KIT, recordsDisplayAt } from './recordsBand.fixture.ts'

// The cell payload carries a record's span and genotype codes, no INFO, so a
// click asks the adapter for the record as LinearBasicDisplay's
// `fetchFullFeature` does, over the record's first base.
function adapterRecord(id: string) {
  return {
    uniqueId: id,
    refName: 'ctgA',
    start: 19508,
    end: 40130,
    INFO: { CLNSIG: ['Pathogenic'], AF: [0.012] },
    samples: { S0: { GT: ['0|1'] } },
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

function recordClick(
  display: ReturnType<typeof recordsDisplayAt>['display'],
  id: string,
) {
  // what the band's `enrich` hands a click: the record, no sample
  return enrichFeatureFromClick(
    display.featureById(id)!,
    display.featureInfoById(id),
  )
}

test('a record click reads its INFO over its first base, not its span', async () => {
  const { display, mockRpcCall } = recordsDisplayAt(KIT, 51)
  stubDetails(mockRpcCall, adapterRecord)
  const full = await display.fetchFullRecord(recordClick(display, '>7494>7499'))
  expect(full.get('INFO')).toEqual({ CLNSIG: ['Pathogenic'], AF: [0.012] })
  const [, , args] = mockRpcCall.mock.calls.find(
    ([, method]) => method === 'GetBasicFeatureDetails',
  )!
  expect(args).toMatchObject({
    featureId: '>7494>7499',
    region: { refName: 'ctgA', start: 19508, end: 19509 },
  })
})

test('the record keeps every sample, over genotype rows and without', async () => {
  const rows = recordsDisplayAt(KIT, 51)
  stubDetails(rows.mockRpcCall, adapterRecord)
  const overRows = await rows.display.fetchFullRecord(
    recordClick(rows.display, '>7494>7499'),
  )
  expect(overRows.get('samples')).toEqual({ S0: { GT: ['0|1'] } })

  const sitesOnly = recordsDisplayAt(KIT, 51, {}, false)
  stubDetails(sitesOnly.mockRpcCall, adapterRecord)
  const recordsOnly = await sitesOnly.display.fetchFullRecord(
    recordClick(sitesOnly.display, '>7494>7499'),
  )
  expect(recordsOnly.get('samples')).toEqual({ S0: { GT: ['0|1'] } })
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

test('the last click wins: an earlier answer landing later is dropped', async () => {
  const { display, mockRpcCall } = recordsDisplayAt(KIT, 51)
  const answers: ((v: unknown) => void)[] = []
  mockRpcCall.mockImplementation((_sid: string, method: string) =>
    method === 'GetBasicFeatureDetails'
      ? new Promise(resolve => {
          answers.push(resolve)
        })
      : new Promise(() => {}),
  )
  const first = display
    .fetchFullRecord(recordClick(display, '>7494>7499'))
    .catch((e: unknown) => e)
  const second = display.fetchFullRecord(recordClick(display, '>7495>7496'))
  answers[1]!({ feature: adapterRecord('>7495>7496') })
  answers[0]!({ feature: adapterRecord('>7494>7499') })
  expect((await second).id()).toBe('>7495>7496')
  expect(isAbortException(await first)).toBe(true)
})
