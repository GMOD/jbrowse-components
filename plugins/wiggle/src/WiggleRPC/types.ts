import type { Source } from '../util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LastStopTokenCheck, Region, StopToken } from '@jbrowse/core/util'

export interface GetScoreMatrixArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  stopTokenCheck?: LastStopTokenCheck
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  sources: Source[]
  statusCallback?: (arg: string) => void
}

export interface WiggleGetSourcesArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
}

export interface WiggleGetGlobalQuantitativeStatsArgs {
  adapterConfig: AnyConfigurationModel
  stopToken?: StopToken
  headers?: Record<string, string>
  sessionId: string
}

export interface WiggleGetMultiRegionQuantitativeStatsArgs {
  adapterConfig: Record<string, unknown>
  stopToken?: StopToken
  sessionId: string
  trackInstanceId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
}
