import { prepareDiagonalizeAdapters } from './prepareDiagonalizeAdapter.ts'
import { assemblyManager } from './testUtils.ts'

import type { AssemblyManager, Region } from '@jbrowse/core/util'

jest.mock('@jbrowse/core/util/tracks', () => ({
  ...jest.requireActual('@jbrowse/core/util/tracks'),
  getRpcSessionId: () => 'test',
}))
jest.mock('./renameRegionsForAdapter.ts', () => ({
  renameRegionsForAdapter: async ({ regions }: { regions: Region[] }) =>
    regions,
  getAdapterToCanonicalRefNameMap: async () => ({}),
}))

const referenceRegions: Region[] = [
  { refName: 'chr1', start: 0, end: 10, assemblyName: 'b' },
]
const currentRegions: Region[] = [
  { refName: 'chr1', start: 0, end: 10, assemblyName: 'a' },
]

// A multi-genome track may declare an alias of the view's assembly, and the
// worker picks the adapter's pair by comparing config text, so each adapter is
// asked for the reordered axis's assembly in its own spelling.
test('each adapter names the target the way its config does', async () => {
  const { adapters } = await prepareDiagonalizeAdapters({
    assemblyManager: assemblyManager as unknown as AssemblyManager,
    displays: [
      { adapterConfig: { assemblyNames: ['aliasOfA', 'b'] } },
      { adapterConfig: { assemblyNames: ['a', 'b'] } },
    ] as never,
    referenceRegions,
    currentRegions,
  })

  expect(adapters.map(a => a.targetAssemblyName)).toEqual(['aliasOfA', 'a'])
})
