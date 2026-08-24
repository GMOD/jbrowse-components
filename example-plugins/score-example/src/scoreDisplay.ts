// #exampleFile shared | the whole display: settings, worker fetch, and the mark
// #region imports
import { defineDisplay } from '@jbrowse/display-kit/defineDisplay'

import type { Feature } from '@jbrowse/core/util'
import type {
  DataContext,
  ParamValues,
} from '@jbrowse/display-kit/defineDisplay'
// #endregion

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

// #region params
// Every setting the display has, and what changing it invalidates: `fetch`
// re-runs the worker, `frame` only redraws. The factory derives the RPC cache
// key from the `fetch` set, so a fetch result can never end up in one.
const params = {
  color: {
    type: 'color',
    defaultValue: '#0068d1',
    description: 'fill color for every score box',
    affects: 'frame',
  },
  scoreColumn: {
    type: 'string',
    defaultValue: 'score',
    description: 'feature attribute used as the score',
    affects: 'fetch',
  },
} as const
// #endregion

type ScoreParams = typeof params
type ScoreParamValues = ParamValues<ScoreParams>

// #region pack
// Pure packer: features -> parallel typed arrays. Kept separate from the fetch
// so it unit-tests without a worker, an adapter, or a plugin manager. Scores
// are normalized to 0..1 against the region's own max so the box heights read
// regardless of the raw score scale.
export function buildScoreResult(
  features: Feature[],
  scoreColumn: string,
): ScoreRegionData {
  const scored = features.filter(f => Number.isFinite(f.get(scoreColumn)))
  const numFeatures = scored.length
  const starts = new Uint32Array(numFeatures)
  const ends = new Uint32Array(numFeatures)
  const scores = new Float32Array(numFeatures)

  let maxScore = 0
  for (const f of scored) {
    maxScore = Math.max(maxScore, f.get(scoreColumn) as number)
  }
  const norm = maxScore || 1

  scored.forEach((f, i) => {
    starts[i] = f.get('start')
    ends[i] = f.get('end')
    scores[i] = (f.get(scoreColumn) as number) / norm
  })

  return { starts, ends, scores, numFeatures }
}
// #endregion

// #region data
// Runs in the worker, once per region. `statusCallback` and `stopToken` go to
// whatever does the slow work rather than only bracketing it, so the progress
// message tracks the download and a cancel reaches it mid-fetch.
export async function fetchScoreData({
  adapter,
  region,
  params,
  stopToken,
  statusCallback,
}: DataContext<ScoreParams>) {
  statusCallback('Fetching features')
  const features = await adapter.getFeaturesArray(region, {
    stopToken,
    statusCallback,
  })
  return buildScoreResult(features, params.scoreColumn)
}
// #endregion

// #region mark
// One box per feature: from `starts` to `ends`, `scores` tall as a fraction of
// the canvas, in the configured color. The GPU pass, the Canvas2D fallback and
// the SVG export all come from this one declaration; there is no shader to
// write and no draw function to keep in step with it.
const scoreMark = {
  type: 'bar',
  x: (d: ScoreRegionData) => d.starts,
  x2: (d: ScoreRegionData) => d.ends,
  y: (d: ScoreRegionData) => d.scores,
  color: (params: ScoreParamValues) => params.color,
} as const
// #endregion

// #region define
export const LinearScoreDisplay = defineDisplay({
  name: 'LinearScoreDisplay',
  displayName: 'Score display (example)',
  trackType: 'FeatureTrack',
  params,
  data: fetchScoreData,
  mark: scoreMark,
})
// #endregion
