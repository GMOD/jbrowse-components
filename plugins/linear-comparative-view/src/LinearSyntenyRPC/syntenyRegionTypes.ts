import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export interface SyntenyRegionData {
  regionStart: number
  genomeFeatures: [string, MultiPairFeature[]][]
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartOffset: number
}

export function getFirstCoverageFromRpcDataMap(rpcDataMap: Map<string, SyntenyRegionData>) {
  for (const data of rpcDataMap.values()) {
    if (data.coverageMaxDepth > 0) {
      return {
        coverageDepths: data.coverageDepths,
        coverageMaxDepth: data.coverageMaxDepth,
        coverageStartOffset: data.coverageStartOffset,
        coverageRegionStart: data.regionStart,
      }
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
