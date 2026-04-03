import {
  getFirstCoverageEntry,
  getGlobalMaxCoverageDepth,
} from '@jbrowse/alignments-core'

import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface SyntenyRegionData {
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
}

function toCoverageRegion(data: SyntenyRegionData) {
  return {
    depths: data.coverageDepths,
    startOffset: data.coverageStartOffset,
    regionStart: data.regionStart,
    maxDepth: data.coverageMaxDepth,
  }
}

export function mergeGenomeRows(rpcDataMap: Map<string, SyntenyRegionData>) {
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

export function getGlobalMaxDepth(rpcDataMap: Map<string, SyntenyRegionData>) {
  return getGlobalMaxCoverageDepth(rpcDataMap, d => d.coverageMaxDepth)
}

export function getFirstCoverage(rpcDataMap: Map<string, SyntenyRegionData>) {
  const entry = getFirstCoverageEntry(rpcDataMap, toCoverageRegion)
  if (entry) {
    return {
      coverageDepths: entry.depths,
      coverageMaxDepth: entry.maxDepth,
      coverageStartOffset: entry.startOffset,
      coverageRegionStart: entry.regionStart,
    }
  }
  return undefined
}

export interface MultiPairGetFeaturesArgs {
  adapterConfig: Record<string, unknown>
  regions: { region: Region; blockKey: string }[]
  bpPerPx: number
  resolution?: number
  sessionId: string
  stopToken?: StopToken
  fetchMetadata?: boolean
  statusCallback?: (msg: string) => void
}

export interface MultiPairGetFeaturesResult {
  regionData: [string, SyntenyRegionData][]
  sources?: { name: string }[]
  chromSizes?: [string, { refName: string; length: number }[]][]
}
