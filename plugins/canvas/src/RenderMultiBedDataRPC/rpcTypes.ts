import type {
  FeatureDataResult,
  RegionTooLargeResult,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { ThemeOptions } from '@mui/material'

export interface MultiBedDisplayConfig {
  [key: string]: unknown
  laneField: string
  laneHeight: number
  color: string
  laneGap: number
}

export interface RenderMultiBedDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  displayConfig: MultiBedDisplayConfig
  region: {
    refName: string
    start: number
    end: number
    assemblyName: string
    reversed?: boolean
  }
  bpPerPx: number
  sources?: { name: string }[]
  maxFeatureDensity?: number
  theme?: ThemeOptions
  stopToken?: StopToken
  statusCallback?: (msg: string) => void
}

export interface MultiBedRenderResult extends FeatureDataResult {
  // featureId → lane key (string). Main thread uses this to compute Y per lane
  // index. Stored on the FlatbushItem as well (laneKey) for hit-test lookup.
  laneKeys: string[]
  // Discovered lane keys present in this batch (deduped). Display merges these
  // into sourcesVolatile so single-adapter-with-sample-column cases auto-populate
  // the lane list.
  discoveredSources: string[]
}

export type RenderMultiBedDataResult =
  | MultiBedRenderResult
  | RegionTooLargeResult

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    RenderMultiBedData: {
      args: RenderMultiBedDataArgs
      return: RenderMultiBedDataResult
    }
  }
}
