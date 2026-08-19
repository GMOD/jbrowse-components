import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import { executeRenderWiggleData } from './executeRenderWiggleData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: jest.fn(),
}))

// `collectWiggleTransferables` names the eight arrays by hand, and its own unit
// test names the same eight — so the two agree by construction and neither can
// see a ninth array added to WiggleSourceData. What can is `rpcResult`'s
// `checkTransferList`, which walks the payload the executor actually returns,
// and it runs only for a method some test drives. This is that test:
// MultiWiggleGetScoreMatrix sat in exactly this state until its list turned out
// wrong in both directions (see explainTransferError.ts's header).
function mockAdapter(counts: number[]) {
  return {
    getFeatureArrays: (region: Region) => {
      const count = counts[Number(region.refName)] ?? 0
      const starts = new Int32Array(count)
      const ends = new Int32Array(count)
      const scores = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        starts[i] = i * 10
        ends[i] = i * 10 + 5
        // straddling the pivot, so the pos/neg split copies rather than aliases
        scores[i] = i % 2 === 0 ? 5 : -5
      }
      return Promise.resolve({
        starts,
        ends,
        scores,
        minScores: undefined,
        maxScores: undefined,
        count,
      })
    },
  }
}

function region(refName: string): Region {
  return { refName, start: 0, end: 1000, assemblyName: 'volvox' }
}

async function run(counts: number[]) {
  jest
    .mocked(getFeatureAdapterOrThrow)
    .mockResolvedValue(mockAdapter(counts) as never)
  return executeRenderWiggleData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: {},
      regions: counts.map((_, i) => region(String(i))),
    },
  })
}

test('every buffer in the payload is in the transfer list', async () => {
  const { value, transferables } = await run([4])
  const [result] = value
  const [source] = result!.sources

  expect(transferables).toContain(source!.featurePositions.buffer)
  expect(transferables).toContain(source!.negFeatureScores.buffer)
})

// several regions, and an empty one: an empty side aliases nothing and gets its
// own zero-length allocation, which is still a buffer the list has to carry
test('several regions, one of them empty, still agree', async () => {
  const { value, transferables } = await run([3, 0, 7])
  expect(value).toHaveLength(3)
  expect(transferables.length).toBeGreaterThan(0)
})

// the pos/neg arrays alias the full ones when every score is on one side, and
// postMessage rejects a transfer list carrying the same buffer twice
test('a one-sided split lists each aliased buffer once', async () => {
  jest.mocked(getFeatureAdapterOrThrow).mockResolvedValue({
    getFeatureArrays: () =>
      Promise.resolve({
        starts: new Int32Array([0, 10]),
        ends: new Int32Array([5, 15]),
        scores: new Float32Array([1, 2]),
        minScores: undefined,
        maxScores: undefined,
        count: 2,
      }),
  } as never)

  const { transferables } = await executeRenderWiggleData({
    pluginManager: {} as PluginManager,
    args: { sessionId: 'test', adapterConfig: {}, regions: [region('ctgA')] },
  })

  expect(new Set(transferables).size).toBe(transferables.length)
})
