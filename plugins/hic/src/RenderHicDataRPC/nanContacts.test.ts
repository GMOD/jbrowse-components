import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import {
  INSTANCE_STRIDE_WORDS,
  getInstanceCount,
  getInstancePosition,
} from '../LinearHicDisplay/components/shaders/hic.iface.generated.ts'
import { executeRenderHicData } from './executeRenderHicData.ts'
import { toContacts } from './testContacts.ts'

import type { TestContact } from './testContacts.ts'
import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 10
const SPAN = 1000

async function run(records: TestContact[]) {
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () =>
        Promise.resolve(toContacts(records, RES)),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: ['a', 'b'].map(refName => ({
        refName,
        start: 0,
        end: SPAN,
        assemblyName: 'a',
      })),
      axisBlocks: [
        { refName: 'a', offsetBp: 0 },
        { refName: 'b', offsetBp: SPAN },
      ],
      originBp: 0,
      resolution: RES,
      normalization: 'KR',
      field: 'observed',
      quantile: 0.95,
    },
  })
  return (res as unknown as { value: HicDataResult }).value
}

function contact(
  bin1: number,
  bin2: number,
  counts: number,
  region2Idx = 0,
): TestContact {
  return { bin1, bin2, counts, region1Idx: 0, region2Idx }
}

describe('a NaN count, the file no-value marker', () => {
  test('gets no instance, and the contacts after it keep theirs', async () => {
    const d = await run([
      contact(1, 2, 5),
      contact(3, 4, Number.NaN),
      contact(5, 6, 7),
      contact(1, 1, Number.NaN, 1),
      contact(2, 2, Number.NaN, 1),
      contact(7, 8, 9, 1),
    ])
    expect(d.numContacts).toBe(3)
    expect(d.instances.length).toBe(3 * INSTANCE_STRIDE_WORDS)
    const counts = Array.from({ length: d.numContacts }, (_, i) =>
      getInstanceCount(d.instances, i),
    )
    expect(counts).toEqual([5, 7, 9])
    expect(getInstancePosition(d.instances, 1, 0)).toBeCloseTo(5 * d.binWidth)
    expect(getInstancePosition(d.instances, 1, 1)).toBeCloseTo(6 * d.binWidth)
    expect(d.pairRuns).toEqual([
      { region1Idx: 0, region2Idx: 0, start: 0, end: 2 },
      { region1Idx: 0, region2Idx: 1, start: 2, end: 3 },
    ])
  })

  test('a region pair with only NaN counts leaves no run', async () => {
    const d = await run([contact(1, 1, Number.NaN), contact(2, 2, 4, 1)])
    expect(d.numContacts).toBe(1)
    expect(d.pairRuns).toEqual([
      { region1Idx: 0, region2Idx: 1, start: 0, end: 1 },
    ])
  })
})
