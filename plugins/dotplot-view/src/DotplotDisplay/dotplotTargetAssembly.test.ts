import { executeDotplotFeaturesAndPositions } from './executeDotplotFeaturesAndPositions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// jest.mock's factory is hoisted, so the spy it closes over must be
// `mock`-prefixed to be allowed out of scope.
const mockGetFeatures = jest.fn(
  async (_regions: Region[], _opts: BaseOptions): Promise<Feature[]> => [],
)

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: async () => ({
    getFeaturesInMultipleRegionsArray: mockGetFeatures,
  }),
}))

function snap(assemblyName: string, refName: string) {
  return {
    bpPerPx: 1,
    displayedRegions: [{ assemblyName, refName, start: 0, end: 1000 }],
  }
}

beforeEach(() => {
  mockGetFeatures.mockClear()
})

// A multi-genome adapter (MCScanBlocksAdapter, AllVsAllPAFAdapter) draws N-1
// pairs from one track and resolves the mate as "the first other entry in
// assemblyNames" when no target is given. A grape x cacao dotplot on a
// grape/peach/cacao track therefore silently fetched the grape x PEACH band,
// whose mate refNames match no vertical-axis region — an empty plot behind the
// "features could not be mapped" warning. Verified against the real adapter:
// omitting the target returns Pp1 (peach) mates, passing 'cacao' returns Tc1.
test('the vertical axis assembly is passed as targetAssemblyName', async () => {
  await executeDotplotFeaturesAndPositions({
    pluginManager: {} as PluginManager,
    sessionId: 'test',
    adapterConfig: {},
    regions: [{ assemblyName: 'grape', refName: 'chr1', start: 0, end: 1000 }],
    hViewSnap: snap('grape', 'chr1'),
    vViewSnap: snap('cacao', 'Tc1'),
  })

  expect(mockGetFeatures.mock.calls[0]![1].targetAssemblyName).toBe('cacao')
})

// A self-alignment dotplot names its own assembly as the target, which is what
// narrows a multi-genome adapter to the paralogy records rather than every mate.
test('a self-alignment dotplot targets its own assembly', async () => {
  await executeDotplotFeaturesAndPositions({
    pluginManager: {} as PluginManager,
    sessionId: 'test',
    adapterConfig: {},
    regions: [{ assemblyName: 'grape', refName: 'chr1', start: 0, end: 1000 }],
    hViewSnap: snap('grape', 'chr1'),
    vViewSnap: snap('grape', 'chr1'),
  })

  expect(mockGetFeatures.mock.calls[0]![1].targetAssemblyName).toBe('grape')
})
