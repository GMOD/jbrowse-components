import {
  computeInsertionIndicators,
  computeSNPCoverage,
  extractIndelsFromCs,
  extractMismatchesFromCs,
} from '@jbrowse/alignments-core'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { computeCoverage } from '@jbrowse/plugin-alignments'

import type {
  MultiPairGetFeaturesArgs,
  MultiPairGetFeaturesResult,
  SyntenyRegionData,
} from './syntenyRegionTypes.ts'
import type { IndelEntry, MismatchEntry } from '@jbrowse/alignments-core'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

interface MultiPairAdapter {
  getMultiPairFeatures(
    query: Region,
    opts: { bpPerPx?: number; stopToken?: StopToken },
  ): Promise<{
    genomeRows: Map<string, MultiPairFeature[]>
  }>
  getSources(): Promise<{ name: string }[]>
  getChromSizes?(): Promise<Map<string, { refName: string; length: number }[]>>
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiPairGetFeatures: {
      args: MultiPairGetFeaturesArgs
      return: MultiPairGetFeaturesResult
    }
  }
}

export class MultiPairGetFeatures extends RpcMethodType {
  name = 'MultiPairGetFeatures'

  async serializeArguments(
    args: Record<string, unknown>,
    _rpcDriverClassName: string,
  ) {
    return args
  }

  async execute(args: MultiPairGetFeaturesArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const {
      adapterConfig,
      regions,
      bpPerPx,
      sessionId,
      stopToken,
      fetchMetadata,
    } = deserializedArgs

    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    const adapter = dataAdapter as unknown as MultiPairAdapter

    let sources: { name: string }[] | undefined
    let chromSizes:
      | [string, { refName: string; length: number }[]][]
      | undefined

    if (fetchMetadata) {
      sources = await adapter.getSources()
      if (adapter.getChromSizes) {
        chromSizes = [...(await adapter.getChromSizes()).entries()]
      }
    }

    const regionData: [number, SyntenyRegionData][] = []

    for (const { region, displayedRegionIndex } of regions) {
      const { genomeRows } = await adapter.getMultiPairFeatures(region, {
        bpPerPx,
        stopToken,
      })

      const regionStart = Math.floor(region.start)
      const regionEnd = Math.ceil(region.end)

      // Collect all features overlapping this region for coverage
      const coverageFeatures: { start: number; end: number }[] = []
      const mismatches: MismatchEntry[] = []
      const indels: IndelEntry[] = []
      const genomeFeatures = [...genomeRows]
      for (const [, features] of genomeRows) {
        for (const f of features) {
          coverageFeatures.push({ start: f.start, end: f.end })
          if (f.cs) {
            extractMismatchesFromCs(f.cs, f.start, mismatches)
            extractIndelsFromCs(f.cs, f.start, indels)
          }
        }
      }

      const coverage = computeCoverage(
        coverageFeatures,
        [],
        regionStart,
        regionEnd,
      )

      const snp = computeSNPCoverage(mismatches, regionStart, coverage)
      const indicators = computeInsertionIndicators(
        indels,
        coverage.depths,
        coverage.startPos,
      )

      const mismatchPositions = new Uint32Array(mismatches.length)
      const mismatchBases = new Uint8Array(mismatches.length)
      for (let i = 0; i < mismatches.length; i++) {
        mismatchPositions[i] = mismatches[i]!.position - regionStart
        mismatchBases[i] = mismatches[i]!.base
      }

      regionData.push([
        displayedRegionIndex,
        {
          refName: region.refName,
          regionStart,
          genomeFeatures,
          coverageDepths: coverage.depths,
          coverageMaxDepth: coverage.maxDepth,
          coverageStartPos: coverage.startPos,
          snpPositions: snp.positions,
          snpYOffsets: snp.yOffsets,
          snpHeights: snp.heights,
          snpColorTypes: snp.colorTypes,
          snpRelDepths: snp.relDepths,
          snpCount: snp.count,
          mismatchPositions,
          mismatchBases,
          numMismatches: mismatches.length,
          indicatorPositions: indicators.positions,
          numIndicators: indicators.count,
        },
      ])
    }

    return {
      regionData,
      sources,
      chromSizes,
    }
  }
}
