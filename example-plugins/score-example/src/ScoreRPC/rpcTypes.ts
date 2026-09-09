// #exampleFile shared | ScoreRegionData and the RPC arg types
import type { Region } from '@jbrowse/core/util'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'

export interface GetScoreDataArgs {
  adapterConfig: Record<string, unknown>
  region: Region
  scoreColumn: string
}

// #region region-data
// One region's worth of features as the encoder packs them: parallel typed
// arrays, `x`/`x2` absolute genomic uint32 (never region-relative, so they
// cross the worker boundary without precision loss) and `y` the raw score,
// plus the score extremes and a hit index over (bp, score). The shape reads
// the arrays under these names.
export type ScoreRegionData = EncodedChannels
// #endregion
