import Flatbush from '@jbrowse/core/util/flatbush'

import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'
import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'

import type { WebGLLDDataResult } from './types.ts'
import type { LDFlatbushItem } from '../LDRenderer/types.ts'
import type { LDMetric } from '../VariantRPC/getLDMatrix.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Region } from '@jbrowse/core/util/types'

interface RenderWebGLLDDataArgs {
  sessionId: string
  adapterConfig: AnyConfigurationModel
  regions: Region[]
  bpPerPx: number
  ldMetric: LDMetric
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  hweFilterThreshold: number
  callRateFilter: number
  jexlFilters: string[]
  signedLD: boolean
  useGenomicPositions: boolean
  fitToHeight: boolean
  displayHeight?: number
  stopToken?: string
}

function emptyResult(signedLD: boolean, metric: LDMetric): WebGLLDDataResult {
  const emptyFlatbush = new Flatbush(1)
  emptyFlatbush.add(0, 0, 0, 0)
  emptyFlatbush.finish()
  return {
    positions: new Float32Array(0),
    ldValues: new Float32Array(0),
    cellSizes: new Float32Array(0),
    numCells: 0,
    maxScore: 1,
    uniformW: 0,
    yScalar: 1,
    metric,
    signedLD,
    flatbush: emptyFlatbush.data,
    items: [],
    snps: [],
  }
}

export async function executeRenderWebGLLDData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderWebGLLDDataArgs
}): Promise<WebGLLDDataResult> {
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
    fitToHeight,
    displayHeight,
  } = args

  const adapterType = adapterConfig.type as string | undefined
  const ldData = await (adapterType === 'PlinkLDAdapter' ||
  adapterType === 'PlinkLDTabixAdapter' ||
  adapterType === 'LdmatAdapter'
    ? getLDMatrixFromPlink({
        pluginManager,
        args: {
          regions,
          sessionId,
          adapterConfig,
          ldMetric,
        },
      })
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

  // Calculate dimensions
  let totalWidthBp = 0
  for (const r of regions) {
    totalWidthBp += r.end - r.start
  }
  const width = totalWidthBp / bpPerPx
  const hyp = width / 2
  const height = fitToHeight ? (displayHeight ?? hyp) : hyp
  const yScalar = fitToHeight ? height / hyp : 1

  const sqrt2 = Math.sqrt(2)
  const uniformW = width / (n * sqrt2)

  // Calculate genomic boundaries for each SNP (when useGenomicPositions is true)
  const boundaries: number[] = []
  if (useGenomicPositions) {
    for (let i = 0; i < n; i++) {
      const snpPos = snps[i]!.start
      const prevPos = i > 0 ? snps[i - 1]!.start : region.start
      const boundaryPos = (prevPos + snpPos) / 2
      boundaries.push((boundaryPos - region.start) / bpPerPx / sqrt2)
    }
    const lastSnpPos = snps[n - 1]!.start
    const finalBoundary = lastSnpPos + 50 * bpPerPx
    boundaries.push((finalBoundary - region.start) / bpPerPx / sqrt2)
  }

  // Count the number of lower-triangular cells: n*(n-1)/2
  const numCells = (n * (n - 1)) / 2
  const positions = new Float32Array(numCells * 2)
  const cellSizes = new Float32Array(numCells * 2)
  const ldVals = new Float32Array(numCells)
  const items: LDFlatbushItem[] = []
  const flatbushCoords: number[] = []

  let ldIdx = 0
  let cellIdx = 0

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      const ldVal = ldValues[ldIdx] ?? 0

      let x: number
      let y: number
      let cellW: number
      let cellH: number

      if (useGenomicPositions) {
        x = boundaries[j]!
        y = boundaries[i]!
        cellW = boundaries[j + 1]! - x
        cellH = boundaries[i + 1]! - y
      } else {
        x = j * uniformW
        y = i * uniformW
        cellW = uniformW
        cellH = uniformW
      }

      positions[cellIdx * 2] = x
      positions[cellIdx * 2 + 1] = y
      cellSizes[cellIdx * 2] = cellW
      cellSizes[cellIdx * 2 + 1] = cellH
      ldVals[cellIdx] = ldVal

      flatbushCoords.push(x, y, x + cellW, y + cellH)
      items.push({
        i,
        j,
        ldValue: ldVal,
        snp1: snps[i]!,
        snp2: snps[j]!,
      })

      ldIdx++
      cellIdx++
    }
  }

  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (flatbushCoords.length) {
    for (let k = 0; k < flatbushCoords.length; k += 4) {
      flatbush.add(
        flatbushCoords[k]!,
        flatbushCoords[k + 1]!,
        flatbushCoords[k + 2],
        flatbushCoords[k + 3],
      )
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    positions,
    ldValues: ldVals,
    cellSizes,
    numCells,
    maxScore: 1,
    uniformW,
    yScalar,
    metric: ldData.metric,
    signedLD,
    flatbush: flatbush.data,
    items,
    snps: ldData.snps,
    filterStats: ldData.filterStats,
    recombination: {
      values: Array.from(ldData.recombination.values),
      positions: ldData.recombination.positions,
    },
  }
}
