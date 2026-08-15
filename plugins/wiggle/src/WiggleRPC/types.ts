import type { Source } from '../util.ts'
import type { LastStopTokenCheck, Region } from '@jbrowse/core/util'

export interface GetScoreMatrixArgs {
  adapterConfig: Record<string, unknown>
  stopTokenCheck?: LastStopTokenCheck
  sessionId: string
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx: number
  sources: Source[]
}
