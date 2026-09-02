import { unwrapRpcResult } from '@jbrowse/core/util/librpc'

import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'
import { executeRenderLDData } from './executeRenderLDData.ts'

import type { LDMatrixResult } from '../VariantRPC/ldTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('../VariantRPC/getLDMatrixFromPlink.ts', () => ({
  ...jest.requireActual('../VariantRPC/getLDMatrixFromPlink.ts'),
  getLDMatrixFromPlink: jest.fn(),
}))

function region(offset = 0): Region {
  return {
    refName: 'chr1',
    start: offset,
    end: offset + 1000,
    assemblyName: 'a',
    reversed: false,
  }
}

// The file named no pair in this region — the state `emptyResult` covers.
const NO_PAIRS: LDMatrixResult = {
  snps: [],
  ldValues: new Float32Array(0),
  metric: 'r2',
  hasR2: true,
  hasDprime: true,
  band: 0,
}

async function run(regions: Region[], useGenomicPositions: boolean) {
  jest.mocked(getLDMatrixFromPlink).mockResolvedValue(NO_PAIRS)
  // the envelope `deserializeReturn` takes off for the real caller: the four
  // Float32Arrays are transferred rather than cloned
  return unwrapRpcResult(
    await executeRenderLDData({
      pluginManager: {} as PluginManager,
      args: {
        sessionId: 'test',
        adapterConfig: { type: 'PlinkLDTabixAdapter' },
        regions,
        originBp: 0,
        ldMetric: 'r2',
        maxVariantSeparation: 0,
        useGenomicPositions,
      },
    }),
  )
}

// `genomicMode` is what the display branches its *chrome* on, not only its
// matrix: `effectiveUseGenomicPositions` picks the label zone over the connector
// zone and sets `effectiveLineZoneHeight`. Reporting `false` on an empty result
// moved the triangle down by `lineZoneHeight` (100px by default) and shrank it
// the moment a region held no pairs — then put it back on the next pan.
test('an empty result keeps reporting the layout mode the display is in', async () => {
  expect((await run([region()], true)).genomicMode).toBe(true)
  expect((await run([region()], false)).genomicMode).toBe(false)
})

// The multi-region fallback still has to survive the empty path, or the jump
// comes back inverted — a request for genomic mode that the worker declines
// would claim genomic layout while the columns are index-laid-out.
test('an empty result still declines genomic mode across multiple regions', async () => {
  expect((await run([region(0), region(5000)], true)).genomicMode).toBe(false)
})

// The metric rides out even with nothing to draw: the legend and the metric
// radios read it off the result, so an empty region must not flip them back to
// the requested value the file could not serve.
test('an empty result still reports the metric the file can serve', async () => {
  const result = await run([region()], true)
  expect(result.numCells).toBe(0)
  expect(result.snps).toEqual([])
  expect(result.metric).toBe('r2')
  expect(result.hasDprime).toBe(true)
})
