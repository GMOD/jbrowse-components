import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'

import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'
import { executeRenderLDData } from './executeRenderLDData.ts'

import type { LDMatrixResult, LDSnp } from '../VariantRPC/getLDMatrix.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'

jest.mock('../VariantRPC/getLDMatrix.ts', () => ({
  ...jest.requireActual('../VariantRPC/getLDMatrix.ts'),
  getLDMatrix: jest.fn(),
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

// Everything filtered out — the state a raised MAF threshold reaches, and the
// one `emptyResult` covers.
function noSurvivors(snps: LDSnp[]): LDMatrixResult {
  return {
    snps,
    ldValues: new Float32Array(0),
    metric: 'r2',
    hasDprime: true,
    method: 'composite',
    band: 0,
    filterStats: {
      totalVariants: 812,
      passedVariants: snps.length,
      filteredByMaf: 812 - snps.length,
      filteredByLength: 0,
      filteredByMultiallelic: 0,
      filteredByHwe: 0,
      filteredByCallRate: 0,
      filteredByJexl: 0,
    },
  }
}

// This suite never passes a `byteLimit`, so the executor measures nothing and
// the refusal arm of its return is unreachable. Narrowed once here rather than
// at every assertion.
function payload<T>(result: T | RegionTooLargeResult) {
  if (isRegionRefused(result)) {
    throw new Error('unexpected region-too-large result')
  }
  return result
}

async function run(regions: Region[], useGenomicPositions: boolean) {
  jest.mocked(getLDMatrix).mockResolvedValue(noSurvivors([]))
  // the envelope `deserializeReturn` takes off for the real caller: the four
  // Float32Arrays are transferred rather than cloned
  return payload(
    unwrapRpcResult(
      await executeRenderLDData({
        pluginManager: {} as PluginManager,
        args: {
          sessionId: 'test',
          adapterConfig: { type: 'VcfTabixAdapter' },
          regions,
          originBp: 0,
          ldMetric: 'r2',
          minorAlleleFrequencyFilter: 0.5,
          lengthCutoffFilter: 0,
          hweFilterThreshold: 0,
          callRateFilter: 0,
          maxVariantSeparation: 0,
          jexlFilters: [],
          signedLD: false,
          useGenomicPositions,
        },
      }),
    ),
  )
}

// `genomicMode` is what the display branches its *chrome* on, not only its
// matrix: `effectiveUseGenomicPositions` picks the label zone over the connector
// zone and sets `effectiveLineZoneHeight`. Reporting `false` on an empty result
// moved the triangle down by `lineZoneHeight` (100px by default) and shrank it
// the moment a filter emptied the matrix — then put it back when the filter came
// down.
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

// Nothing else about the empty payload moves: the status bar reads `filterStats`
// off it, and that is the only thing on screen explaining the emptiness.
test('an empty result still carries the filter stats that explain it', async () => {
  const result = await run([region()], true)
  expect(result.numCells).toBe(0)
  expect(result.snps).toEqual([])
  expect(result.filterStats?.totalVariants).toBe(812)
  expect(result.filterStats?.filteredByMaf).toBe(812)
})
