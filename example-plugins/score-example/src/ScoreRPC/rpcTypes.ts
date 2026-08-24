// #exampleFile shared | ScoreRegionData and the RPC arg types
import type { Region } from '@jbrowse/core/util'

export interface GetScoreDataArgs {
  adapterConfig: Record<string, unknown>
  region: Region
  scoreColumn: string
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
