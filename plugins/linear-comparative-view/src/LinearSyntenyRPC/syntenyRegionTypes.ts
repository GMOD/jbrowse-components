import { getGlobalMaxCoverageDepth } from '@jbrowse/alignments-core'

import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface SyntenyRegionData {
  refName: string
  regionStart: number
  genomeFeatures: [string, MultiPairFeature[]][]
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartOffset: number
  snpPositions: Uint32Array
  snpYOffsets: Float32Array
  snpHeights: Float32Array
  snpColorTypes: Uint8Array
  snpCount: number
  mismatchPositions: Uint32Array
  mismatchBases: Uint8Array
  numMismatches: number
}

export function mergeGenomeRows(rpcDataMap: Map<number, SyntenyRegionData>) {
  const merged = new Map<string, MultiPairFeature[]>()
  for (const data of rpcDataMap.values()) {
    for (const [genome, features] of data.genomeFeatures) {
      const existing = merged.get(genome)
      if (existing) {
        for (const f of features) {
          existing.push(f)
        }
      } else {
        merged.set(genome, [...features])
      }
    }
  }
  return merged
}

export function getGlobalMaxDepth(rpcDataMap: Map<number, SyntenyRegionData>) {
  return getGlobalMaxCoverageDepth(rpcDataMap, d => d.coverageMaxDepth)
}

export function getFirstCoverage(rpcDataMap: Map<number, SyntenyRegionData>) {
  for (const data of rpcDataMap.values()) {
    if (data.coverageMaxDepth > 0) {
      return data
    }
  }
  return undefined
}

export interface MultiPairGetFeaturesArgs {
  adapterConfig: Record<string, unknown>
  regions: { region: Region; regionNumber: number }[]
  bpPerPx: number
  resolution?: number
  sessionId: string
  stopToken?: StopToken
  fetchMetadata?: boolean
  statusCallback?: (msg: string) => void
}

export interface MultiPairGetFeaturesResult {
  regionData: [number, SyntenyRegionData][]
  sources?: { name: string }[]
  chromSizes?: [string, { refName: string; length: number }[]][]
}
