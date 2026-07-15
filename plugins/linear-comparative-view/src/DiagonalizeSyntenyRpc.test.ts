import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import DiagonalizeSyntenyRpc from './DiagonalizeSyntenyRpc.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

// Capture the opts the RPC passes to getFeatures so we can assert the pair
// selector (targetAssemblyName) is forwarded — a multi-genome adapter needs it
// to draw the right band, and dropping the forward silently reintroduces the
// "middle row never diagonalizes" bug.
jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter')
const getFeaturesInMultipleRegionsArray = jest.fn()
jest
  .mocked(getFeatureAdapterOrThrow)
  .mockResolvedValue({ getFeaturesInMultipleRegionsArray } as never)

function feature(
  id: string,
  refName: string,
  start: number,
  mateRefName: string,
) {
  return new SimpleFeature({
    uniqueId: id,
    refName,
    start,
    end: start + 100,
    strand: 1,
    mate: { refName: mateRefName, start, end: start + 100 },
  })
}

test('execute forwards targetAssemblyName to getFeatures and reorders the query row', async () => {
  // peach (ref/top) has two chroms p1,p2; the fetched alignments put cacao c2 on
  // p1 (left) and c1 on p2 (right), so diagonalization must reorder cacao to
  // [c2, c1] — the opposite of its input [c1, c2].
  getFeaturesInMultipleRegionsArray.mockImplementation(
    (_regions: unknown, _opts: BaseOptions) =>
      Promise.resolve([
        feature('a', 'p1', 100, 'c2'),
        feature('b', 'p2', 100, 'c1'),
      ]),
  )

  const rpc = new DiagonalizeSyntenyRpc({
    jexl: {},
  } as unknown as PluginManager)

  const result = await rpc.execute(
    {
      sessionId: 'test',
      adapters: [
        {
          adapterConfig: {},
          fetchRegions: [],
          refRefNameMap: {},
          queryRefNameMap: {},
        },
      ],
      referenceRegions: [
        { refName: 'p1', start: 0, end: 1000, assemblyName: 'peach' },
        { refName: 'p2', start: 0, end: 1000, assemblyName: 'peach' },
      ],
      currentRegions: [
        { refName: 'c1', start: 0, end: 1000, assemblyName: 'cacao' },
        { refName: 'c2', start: 0, end: 1000, assemblyName: 'cacao' },
      ],
      targetAssemblyName: 'cacao',
      bpPerPx: 1,
    },
    'MainThreadRpcDriver',
  )

  // the pair selector reached the adapter
  expect(getFeaturesInMultipleRegionsArray).toHaveBeenCalledWith(
    [],
    expect.objectContaining({ targetAssemblyName: 'cacao' }),
  )
  // and the query row actually reordered against the reference
  expect(result?.newRegions.map(r => r.refName)).toEqual(['c2', 'c1'])
})
