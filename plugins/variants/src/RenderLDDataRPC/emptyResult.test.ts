import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import { triangleAxis } from '@jbrowse/display-kit/triangleTransform'

import { executeRenderLDData } from './executeRenderLDData.ts'
import { getLDMatrixFromPlink } from './getLDMatrixFromPlink.ts'

import type { LDMatrixResult } from './ldTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util'

jest.mock('./getLDMatrixFromPlink.ts', () => ({
  ...jest.requireActual('./getLDMatrixFromPlink.ts'),
  getLDMatrixFromPlink: jest.fn(),
}))

// each region its own displayed region, end to end on the view's axis
function axisBlocksOf(regions: Region[]) {
  return triangleAxis(
    regions.map((r, displayedRegionIndex) => ({ ...r, displayedRegionIndex })),
    regions,
  ).axisBlocks
}

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
  appliedField: 'r2',
  hasR2: true,
  hasDprime: true,
  band: 0,
}

function execute(
  regions: Region[],
  useGenomicPositions: boolean,
  matrix = NO_PAIRS,
) {
  jest.mocked(getLDMatrixFromPlink).mockResolvedValue(matrix)
  return executeRenderLDData({
    pluginManager: {} as PluginManager,
    args: {
      sessionId: 'test',
      adapterConfig: { type: 'PlinkLDTabixAdapter' },
      regions,
      axisBlocks: axisBlocksOf(regions),
      originBp: 0,
      spanBp: regions.reduce((sum, r) => sum + r.end - r.start, 0),
      field: 'r2',
      layout: useGenomicPositions ? 'genomic' : 'columns',
    },
  })
}

// the envelope `deserializeReturn` takes off for the real caller
async function run(regions: Region[], useGenomicPositions: boolean) {
  return unwrapRpcResult(await execute(regions, useGenomicPositions))
}

// `appliedLayout` is what the display branches its *chrome* on, not only its
// matrix: `atGenomicPositions` picks the label zone over the connector
// zone and sets `matrixTop`. Reporting `false` on an empty result
// moved the triangle down by `connectorsHeight` (100px by default) and shrank it
// the moment a region held no pairs — then put it back on the next pan.
test('an empty result keeps reporting the layout mode the display is in', async () => {
  expect((await run([region()], true)).appliedLayout).toBe('genomic')
  expect((await run([region()], false)).appliedLayout).toBe('columns')
})

// Several regions sit end to end on the view's axis, so genomic mode holds
// across them, empty or not.
test('an empty result keeps genomic mode across multiple regions', async () => {
  expect((await run([region(0), region(5000)], true)).appliedLayout).toBe(
    'genomic',
  )
})

// The metric rides out even with nothing to draw: the legend and the metric
// radios read it off the result, so an empty region must not flip them back to
// the requested value the file could not serve.
test('an empty result still reports the metric the file can serve', async () => {
  const result = await run([region()], true)
  expect(result.ldValues).toHaveLength(0)
  expect(result.snps).toEqual([])
  expect(result.appliedField).toBe('r2')
  expect(result.hasDprime).toBe(true)
})

// The GPU pack builds genomic cells from `boundaries` on the main thread, so
// the worker ships the same 4 bytes a cell at either layout.
test('a genomic result transfers only the values and the boundaries', async () => {
  const snps = [100, 200, 400].map(start => ({
    id: `rs${start}`,
    refName: 'chr1',
    start,
    end: start + 1,
  }))
  const ldValues = new Float32Array([0.1, 0.2, 0.3])
  const { value, transferables } = await execute([region()], true, {
    ...NO_PAIRS,
    snps,
    ldValues,
    band: 2,
  })
  expect(value.appliedLayout).toBe('genomic')
  expect(transferables).toHaveLength(2)
  expect(transferables).toContain(ldValues.buffer)
  expect(transferables).toContain(value.boundaries.buffer)
})
