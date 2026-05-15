import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface RenderManhattanDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  stopToken?: StopToken
  statusCallback?: (msg: string) => void
}

export interface ManhattanRpcResult {
  positions: Uint32Array
  scores: Float32Array
  numFeatures: number
  scoreMin: number
  scoreMax: number
  scoreSum: number
  scoreSumSq: number
}
