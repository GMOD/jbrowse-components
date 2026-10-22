import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { getInstanceCount } from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type { MultiRegionContacts } from '../HicAdapter/HicAdapter.ts'
import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

async function render(contacts: MultiRegionContacts) {
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
      resolution: 10,
      normalization: 'KR',
      field: 'observed/control',
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

function twoPairs() {
  return toContacts(
    [
      { bin1: 0, bin2: 0, counts: 9, region1Idx: 0, region2Idx: 0 },
      { bin1: 0, bin2: 3, counts: 0, region1Idx: 0, region2Idx: 0 },
      { bin1: 5, bin2: 5, counts: 3, region1Idx: 0, region2Idx: 1 },
    ],
    10,
  )
}

// Both scaled to the geometric-mean depth, then a pseudocount of 1: with the
// control four times as deep, the map's counts double and the control's halve
test('each count over its control, both scaled to their depth', async () => {
  const contacts = twoPairs()
  contacts.pairs[0]!.control = {
    counts: Float32Array.of(4, 1),
    depth: 1,
    controlDepth: 4,
  }
  contacts.pairs[1]!.control = {
    counts: Float32Array.of(3),
    depth: 2,
    controlDepth: 2,
  }
  const data = await render(contacts)
  expect(data.appliedField).toBe('observed/control')
  // (9*2 + 1) / (4/2 + 1) = 19/3; a cell the map lost, (0 + 1) / (1/2 + 1) =
  // 2/3; equal depth, (3 + 1) / (3 + 1) = 1
  expect(values(data)).toEqual([Math.fround(19 / 3), Math.fround(2 / 3), 1])
  expect(Array.from(data.operands!.observed)).toEqual([9, 0, 3])
  expect(Array.from(data.operands!.control)).toEqual([4, 1, 3])
})

test('a pair the control lacks is left out', async () => {
  const contacts = twoPairs()
  contacts.pairs[1]!.control = {
    counts: Float32Array.of(3),
    depth: 2,
    controlDepth: 2,
  }
  const data = await render(contacts)
  expect(values(data)).toEqual([1])
  expect(data.pairRuns.map(run => run.region2Idx)).toEqual([1])
})

test('no control matrix at the binsize paints counts and says so', async () => {
  const data = await render(twoPairs())
  expect(data.appliedField).toBe('observed')
  expect(values(data)).toEqual([9, 0, 3])
  expect(data.operands).toBeUndefined()
})

// scaled both halves of the way to one depth, the comparison has no favored
// side: swapping the map and its control inverts every ratio
test('a map over its control is the inverse of the control over the map', async () => {
  const one = (
    counts: number,
    control: number,
    depth: number,
    controlDepth: number,
  ) => {
    const contacts = toContacts(
      [{ bin1: 0, bin2: 2, counts, region1Idx: 0, region2Idx: 0 }],
      10,
    )
    contacts.pairs[0]!.control = {
      counts: Float32Array.of(control),
      depth,
      controlDepth,
    }
    return render(contacts).then(data => values(data)[0]!)
  }
  const forward = await one(9, 4, 3, 7)
  const backward = await one(4, 9, 7, 3)
  expect(forward * backward).toBeCloseTo(1, 6)
})
