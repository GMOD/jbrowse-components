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
