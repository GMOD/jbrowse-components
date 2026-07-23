import { updateStatus } from '@jbrowse/core/util'

import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'
import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'
import { buildGenomicCellBuffers, computeBoundaries } from './ldLayout.ts'
import { applyDisplayOrder, getDisplayOrder } from './reversedRegions.ts'
import { PRECOMPUTED_LD_ADAPTERS } from './types.ts'

import type { LDMethod, LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type { RenderLDDataArgs } from './RenderLDData.ts'
import type { LDDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { StatusCallback } from '@jbrowse/core/util'

type ExecuteArgs = RenderLDDataArgs & {
  statusCallback?: StatusCallback
}

function emptyResult(
  signedLD: boolean,
  metric: LDMetric,
  method: LDMethod,
): LDDataResult {
  return {
    ldValues: new Float32Array(0),
    boundaries: new Float32Array(0),
    numCells: 0,
    uniformW: 0,
    metric,
    hasDprime: true,
    method,
    signedLD,
    snps: [],
  }
}

export async function executeRenderLDData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: ExecuteArgs
}): Promise<LDDataResult> {
  const {
    sessionId,
    adapterConfig,
    regions,
    bpPerPx,
    ldMetric,
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    hweFilterThreshold,
    callRateFilter,
    jexlFilters,
    signedLD,
    useGenomicPositions,
    statusCallback,
  } = args

  const isPrecomputed = (PRECOMPUTED_LD_ADAPTERS as readonly string[]).includes(
    adapterConfig.type,
  )
  const ldData = await (isPrecomputed
    ? updateStatus('Downloading LD data', statusCallback, () =>
        getLDMatrixFromPlink({
          pluginManager,
          args: {
            regions,
            sessionId,
            adapterConfig,
            ldMetric,
          },
        }),
      )
    : getLDMatrix({
        pluginManager,
        args: {
          regions,
          sessionId,
          adapterConfig,
          bpPerPx,
          ldMetric,
          minorAlleleFrequencyFilter,
          lengthCutoffFilter,
          hweFilterThreshold,
          callRateFilter,
          jexlFilters,
          signedLD,
          stopToken: args.stopToken,
          statusCallback,
        },
      }))

  if (ldData.snps.length === 0) {
    return {
      ...emptyResult(signedLD, ldMetric, ldData.method),
      filterStats: ldData.filterStats,
    }
  }

  const region = regions[0]
  if (!region) {
    return emptyResult(signedLD, ldMetric, ldData.method)
  }

  // LD values themselves are orientation-free; only the axis is. A reversed
  // displayed region is folded in once here, on the layout side of the worker,
  // so every consumer of `snps`/`boundaries` (both renderers, hitTest,
  // connector lines, labels, SVG export) stays forward-only.
  const displayOrder = getDisplayOrder(ldData.snps, regions)
  const { snps, ldValues, recombination } = displayOrder
    ? applyDisplayOrder(ldData, displayOrder)
    : ldData
  const n = snps.length

  const totalWidthBp = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  const width = totalWidthBp / bpPerPx
  const uniformW = width / (n * Math.SQRT2)
  const numCells = (n * (n - 1)) / 2

  // Genomic-positions mode maps each SNP onto a single continuous bp axis
  // (offset from the region's left screen edge), which is only meaningful for
  // one contiguous region. With multiple regions (e.g. a split/multi-region
  // view) SNPs from later regions would collapse onto the first region's
  // coordinates, so fall back to uniform cells there.
  const genomicMode = useGenomicPositions && regions.length === 1

  const boundaries = computeBoundaries({
    snps,
    region,
    bpPerPx,
    uniformW,
    genomicMode,
  })
  const cellBuffers = genomicMode
    ? buildGenomicCellBuffers(boundaries)
    : undefined

  return {
    ldValues,
    boundaries,
    numCells,
    uniformW,
    metric: ldData.metric,
    hasDprime: ldData.hasDprime,
    method: ldData.method,
    signedLD,
    snps,
    filterStats: ldData.filterStats,
    recombination: {
      values: recombination.values,
      positions: recombination.positions,
    },
    ...cellBuffers,
  }
}
