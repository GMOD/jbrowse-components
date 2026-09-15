import { executeDotplotFeaturesAndPositions } from './executeDotplotFeaturesAndPositions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

const FEATURE_COUNT = 200
const MS_PER_FEATURE = 2
let visited = 0

function burn(ms: number) {
  const until = performance.now() + ms
  let spins = 0
  while (performance.now() < until) {
    spins++
  }
  return spins
}

const mockFeatures = Array.from(
  { length: FEATURE_COUNT },
  (_, i) =>
    ({
      id: () => `f${i}`,
      get: () => {
        visited++
        burn(MS_PER_FEATURE)
        return undefined
      },
    }) as unknown as Feature,
)

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: async () => ({
    getFeaturesInMultipleRegionsArray: async () => mockFeatures,
  }),
}))

const snap = {
  bpPerPx: 1,
  displayedRegions: [
    { assemblyName: 'grape', refName: 'chr1', start: 0, end: 1000 },
  ],
}

test('an abort posted while the position loop runs stops it mid-loop', async () => {
  const signal = AbortSignal.timeout(20)

  await expect(
    executeDotplotFeaturesAndPositions({
      pluginManager: {} as PluginManager,
      sessionId: 'test',
      adapterConfig: {},
      regions: snap.displayedRegions,
      hViewSnap: snap,
      vViewSnap: snap,
      signal,
    }),
  ).rejects.toThrow(/aborted/)
  expect(visited).toBeLessThan(FEATURE_COUNT / 2)
})
