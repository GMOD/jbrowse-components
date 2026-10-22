import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { getInstanceCount } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type { MultiRegionContacts } from '../HicAdapter/HicAdapter.ts'
import type { HicColorField } from '../LinearHicDisplay/hicColorConfigSchema.ts'
import type { HicDataResult } from './types.ts'
import type { ExpectedValues } from '@gmod/hic'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 10

async function render(
  contacts: MultiRegionContacts,
  field: HicColorField = 'observed/expected',
) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () => Promise.resolve(contacts),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: [
        { refName: 'a', start: 0, end: 1000, assemblyName: 'a' },
        { refName: 'b', start: 0, end: 1000, assemblyName: 'a' },
      ],
      axisBlocks: [
        { refName: 'a', offsetBp: 0 },
        { refName: 'b', offsetBp: 1000 },
      ],
      originBp: 0,
      resolution: RES,
      normalization: 'KR',
      field,
      quantile: 0.95,
    },
  })
  return (res as unknown as { value: HicDataResult }).value
}

function values(data: HicDataResult) {
  return Array.from({ length: data.numContacts }, (_, i) =>
    getInstanceCount(data.instances, i),
  )
}

// within a region, expected indexes by distance from the first one the pair
// spans; between regions on two chromosomes it is one average
const INTRA: ExpectedValues = {
  kind: 'intra',
  firstDistance: 0,
  values: Float64Array.of(8, 4, 2, 1),
}
const INTER: ExpectedValues = { kind: 'inter', average: 0.5 }

function threePairs() {
  const contacts = toContacts(
    [
      { bin1: 0, bin2: 0, counts: 16, region1Idx: 0, region2Idx: 0 },
      { bin1: 0, bin2: 3, counts: 3, region1Idx: 0, region2Idx: 0 },
      { bin1: 5, bin2: 5, counts: 2, region1Idx: 0, region2Idx: 1 },
      { bin1: 7, bin2: 8, counts: 9, region1Idx: 1, region2Idx: 1 },
    ],
    RES,
  )
  return contacts
}

test('each count is divided by its pair expected count', async () => {
  const contacts = threePairs()
  contacts.pairs[0]!.expected = INTRA
  contacts.pairs[1]!.expected = INTER
  contacts.pairs[2]!.expected = INTRA
  const data = await render(contacts)
  expect(data.appliedField).toBe('observed/expected')
  // 16 / 8 at distance 0, 3 / 1 at distance 3, 2 / 0.5 between, 9 / 4 at 1
  expect(values(data)).toEqual([2, 3, 4, 2.25])
  expect(data.pairRuns.map(run => run.expected)).toEqual([INTRA, INTER, INTRA])
})

// a pair whose expected values the file lacks would paint its counts on a
// ratio ramp, which reads as enrichment
test('a pair with no expected values is left out', async () => {
  const contacts = threePairs()
  contacts.pairs[0]!.expected = INTRA
  contacts.pairs[2]!.expected = INTRA
  const data = await render(contacts)
  expect(data.appliedField).toBe('observed/expected')
  expect(values(data)).toEqual([2, 3, 2.25])
  expect(data.pairRuns.map(run => [run.region1Idx, run.region2Idx])).toEqual([
    [0, 0],
    [1, 1],
  ])
})

test('a file with no expected values at the binsize paints its counts', async () => {
  const data = await render(threePairs())
  expect(data.appliedField).toBe('observed')
  expect(values(data)).toEqual([16, 3, 2, 9])
  expect(data.pairRuns.every(run => run.expected === undefined)).toBe(true)
})

test('a zero expected count makes no ratio', async () => {
  const contacts = threePairs()
  contacts.pairs[0]!.expected = {
    kind: 'intra',
    firstDistance: 0,
    values: Float64Array.of(0, 1, 1, 1),
  }
  const data = await render(contacts)
  expect(values(data)).toEqual([3])
})

test('counts ask for no division', async () => {
  const contacts = threePairs()
  contacts.pairs[0]!.expected = INTRA
  const data = await render(contacts, 'observed')
  expect(data.appliedField).toBe('observed')
  expect(values(data)).toEqual([16, 3, 2, 9])
})
