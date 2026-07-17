import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { SimpleFeature } from '@jbrowse/core/util'

import DiagonalizeDotplotRpc from './DiagonalizeDotplotRpc.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Mirrors DiagonalizeSyntenyRpc.test.ts: both RPCs now share one body in
// @jbrowse/synteny-core, so this pins the dotplot's own registration and arg
// shape (the pair selector must reach the adapter, and the vertical axis must
// actually reorder against the horizontal one).
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

// targetAssemblyName is not an argument: it is derived from currentRegions'
// assembly, so the caller cannot forget it (which is exactly how the dotplot
// used to diagonalize against the wrong band). Passing no target here and
// asserting 'cacao' reaches the adapter is what proves the derivation.
test('derives the pair selector from the vertical axis and reorders it', async () => {
  // grape (horizontal) has g1,g2; the alignments put cacao c2 on g1 and c1 on
  // g2, so the vertical axis must reorder to [c2, c1] from its input [c1, c2].
  getFeaturesInMultipleRegionsArray.mockResolvedValue([
    feature('a', 'g1', 100, 'c2'),
    feature('b', 'g2', 100, 'c1'),
  ])

  const rpc = new DiagonalizeDotplotRpc({
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
        { refName: 'g1', start: 0, end: 1000, assemblyName: 'grape' },
        { refName: 'g2', start: 0, end: 1000, assemblyName: 'grape' },
      ],
      currentRegions: [
        { refName: 'c1', start: 0, end: 1000, assemblyName: 'cacao' },
        { refName: 'c2', start: 0, end: 1000, assemblyName: 'cacao' },
      ],
    },
    'MainThreadRpcDriver',
  )

  expect(getFeaturesInMultipleRegionsArray).toHaveBeenCalledWith(
    [],
    expect.objectContaining({ targetAssemblyName: 'cacao' }),
  )
  expect(result?.newRegions.map(r => r.refName)).toEqual(['c2', 'c1'])
})

// An empty pair reads as "nothing to reorder" rather than throwing, so an
// init-time auto-diagonalize still resolves instead of stalling.
test('returns null when the pair has no alignments', async () => {
  getFeaturesInMultipleRegionsArray.mockResolvedValue([])

  const rpc = new DiagonalizeDotplotRpc({
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
        { refName: 'g1', start: 0, end: 1000, assemblyName: 'grape' },
      ],
      currentRegions: [
        { refName: 'c1', start: 0, end: 1000, assemblyName: 'cacao' },
      ],
    },
    'MainThreadRpcDriver',
  )

  expect(result).toBeNull()
})
