import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface GetScoreDataArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  region: Region
  scoreColumn: string
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

// #region region-data
// One region's worth of features packed into parallel typed arrays. Positions
// are absolute genomic uint32 (never region-relative) so they cross the worker
// boundary without precision loss and the renderer can map them directly.
export interface ScoreRegionData {
  starts: Uint32Array
  ends: Uint32Array
  // score normalized to 0..1 (fraction of the region's max), driving box height
  scores: Float32Array
  numFeatures: number
}
// #endregion
