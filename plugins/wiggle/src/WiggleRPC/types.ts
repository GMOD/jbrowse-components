import type { Source } from '../util.ts'
import type { Region } from '@jbrowse/core/util'

export interface GetScoreMatrixArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  bpPerPx: number
  sources: Source[]
  scoreField?: string
}
