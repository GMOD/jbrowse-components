import { updateStatus } from '@jbrowse/core/util'

import { PRECOMPUTED_LD_ADAPTERS } from './types.ts'
import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'
import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'

import type { RenderLDDataArgs } from './RenderLDData.ts'
import type { LDDataResult } from './types.ts'
import type { LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

type ExecuteArgs = RenderLDDataArgs & {
  statusCallback?: (msg: string) => void
}

function emptyResult(signedLD: boolean, metric: LDMetric): LDDataResult {
  return {
    ldValues: new Float32Array(0),
    boundaries: new Float32Array(0),
    numCells: 0,
    uniformW: 0,
    metric,
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
    ? updateStatus('Loading LD data', statusCallback, () =>
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
      ...emptyResult(signedLD, ldMetric),
      filterStats: ldData.filterStats,
    }
  }

  const { snps, ldValues } = ldData
  const n = snps.length
  const region = regions[0]
  if (!region) {
    return emptyResult(signedLD, ldMetric)
  }

  const totalWidthBp = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  const width = totalWidthBp / bpPerPx
  const uniformW = width / (n * Math.SQRT2)
  const numCells = (n * (n - 1)) / 2

  // Compute n+1 boundary positions.
  // For uniform mode: boundaries[k] = k * uniformW (trivially computed).
  // For genomic mode: midpoints between adjacent SNP positions (pre-rotation).
  const boundaries = new Float32Array(n + 1)
  if (useGenomicPositions) {
    for (let i = 0; i < n; i++) {
      const snpPos = snps[i]!.start
      const prevPos = i > 0 ? snps[i - 1]!.start : region.start
      const boundaryPos = (prevPos + snpPos) / 2
      boundaries[i] = (boundaryPos - region.start) / bpPerPx / Math.SQRT2
    }
    const lastSnpPos = snps[n - 1]!.start
    boundaries[n] =
      (lastSnpPos + 50 * bpPerPx - region.start) / bpPerPx / Math.SQRT2
  } else {
    for (let i = 0; i <= n; i++) {
      boundaries[i] = i * uniformW
    }
  }

  // For genomic positions mode, also build the interleaved per-cell buffer
  // used by GpuLDRenderer (positions + cellSizes for the GENOMIC pass).
  // Uniform mode skips this O(N²) loop entirely.
  let positions: Float32Array | undefined
  let cellSizes: Float32Array | undefined
  if (useGenomicPositions) {
    positions = new Float32Array(numCells * 2)
    cellSizes = new Float32Array(numCells * 2)
    let cellIdx = 0
    for (let i = 1; i < n; i++) {
      const y = boundaries[i]!
      const ch = boundaries[i + 1]! - y
      for (let j = 0; j < i; j++) {
        const x = boundaries[j]!
        const cw = boundaries[j + 1]! - x
        positions[cellIdx * 2] = x
        positions[cellIdx * 2 + 1] = y
        cellSizes[cellIdx * 2] = cw
        cellSizes[cellIdx * 2 + 1] = ch
        cellIdx++
      }
    }
  }

  return {
    ldValues,
    boundaries,
    numCells,
    uniformW,
    metric: ldData.metric,
    signedLD,
    snps: ldData.snps,
    filterStats: ldData.filterStats,
    recombination: {
      values: ldData.recombination.values,
      positions: ldData.recombination.positions,
    },
    ...(positions && cellSizes && { positions, cellSizes }),
  }
}
