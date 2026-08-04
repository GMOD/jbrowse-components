import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import { executeRenderHicData } from './executeRenderHicData.ts'

import type { HicDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/core/data_adapters/dataAdapterCache', () => ({
  getAdapter: jest.fn(),
}))

const RES = 10

async function statsFor(counts: number[]) {
  const records = counts.map((c, i) => ({
    bin1: i,
    bin2: i,
    counts: c,
    region1Idx: 0,
    region2Idx: 0,
  }))
  jest.mocked(getAdapter).mockResolvedValue({
    dataAdapter: {
      getMultiRegionContactRecords: () =>
        Promise.resolve({
          records,
          resolution: RES,
          appliedNormalization: 'KR',
        }),
    },
  } as unknown as Awaited<ReturnType<typeof getAdapter>>)
  const res = await executeRenderHicData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: [{ refName: 'a', start: 0, end: 1000, assemblyName: 'a' }],
      regionOffsetsPx: [0],
      bpPerPx: 1,
      resolution: RES,
      normalization: 'KR',
    },
  })
  const { maxScore, percentile95, numContacts } = (
    res as unknown as { value: HicDataResult }
  ).value
  return { maxScore, percentile95, numContacts }
}

// 100 ascending counts, so the 95th percentile is a distinct, checkable value
// rather than coinciding with the max.
const ASCENDING = Array.from({ length: 100 }, (_, i) => i + 1)

describe('hic count statistics', () => {
  test('reads max and the 95th percentile off the sorted counts', async () => {
    const { maxScore, percentile95 } = await statsFor(ASCENDING)
    expect(maxScore).toBe(100)
    // floor(0.95 * 99) = 94 -> the 95th of the ascending values
    expect(percentile95).toBe(95)
  })

  test('an empty result scores zero rather than reading off an empty array', async () => {
    expect(await statsFor([])).toEqual({
      maxScore: 0,
      percentile95: 0,
      numContacts: 0,
    })
  })

  // A typed-array sort puts NaN last, so scoring off the raw counts made a
  // single non-finite value the max. NaN then propagates through
  // `Math.max(colorMaxScore, ...)` in both the shader and `mapHicCount`, so
  // every bin's color maps to NaN and the legend disappears (`hasLegendData`
  // reads `NaN > 0`). Both non-finites are reachable from a real file: NaN is
  // the .hic dense-block "no value" marker, which only the dense parse path
  // filters, and a tiny normalization divisor yields Infinity.
  test.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('one %s count does not poison the color scale', async (_name, bad) => {
    const { maxScore, percentile95, numContacts } = await statsFor([
      ...ASCENDING,
      bad,
    ])
    expect(maxScore).toBe(100)
    expect(percentile95).toBe(95)
    // the bad contact is still drawn (as its own bin), only excluded from scoring
    expect(numContacts).toBe(101)
  })

  test('all-non-finite counts score zero, so hasLegendData reads false', async () => {
    const { maxScore, percentile95 } = await statsFor([
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])
    expect(maxScore).toBe(0)
    expect(percentile95).toBe(0)
  })
})
