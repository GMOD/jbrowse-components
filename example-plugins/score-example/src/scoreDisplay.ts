// #exampleFile shared | the whole display: settings, worker fetch, painter, shader passes
// #region imports
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { defineDisplay } from '@jbrowse/display-kit/defineDisplay'
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import {
  bpToScreenPx,
  forEachClippedBlock,
} from '@jbrowse/render-core/canvas2dUtils'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'

import type { Feature } from '@jbrowse/core/util'
import type {
  DataContext,
  DisplayRenderState,
  GpuSpec,
  Paint,
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
export type ScoreRenderState = DisplayRenderState<ScoreParams>

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

// #region paint
// Pure draw function: paints the visible blocks into any 2D context. Ctx2D =
// CanvasRenderingContext2D | SvgCanvas, so the same implementation backs the
// on-screen Canvas2D fallback and SVG export.
export const drawScoreBlocks: Paint<ScoreRegionData, ScoreParams> = (
  ctx,
  regions,
  blocks,
  { canvasWidth, canvasHeight, params },
) => {
  ctx.fillStyle = params.color
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => regions.get(block.displayedRegionIndex),
    (data, block) => {
      const { start, end, screenStartPx, screenEndPx, reversed } = block
      for (let i = 0; i < data.numFeatures; i++) {
        const left = bpToScreenPx(
          data.starts[i]!,
          start,
          end,
          screenStartPx,
          screenEndPx,
          reversed,
        )
        const right = bpToScreenPx(
          data.ends[i]!,
          start,
          end,
          screenStartPx,
          screenEndPx,
          reversed,
        )
        const h = data.scores[i]! * canvasHeight
        ctx.fillRect(
          Math.min(left, right),
          canvasHeight - h,
          Math.abs(right - left) || 1,
          h,
        )
      }
    },
  )
}
// #endregion

// #region gpu
// The optional accelerator: one pass whose instance buffer the generated
// `packInstances` interleaves from the region's arrays, and the uniforms one
// clipped block draws with. `bpRangeXTuple` carries the hp-split genomic ->
// clip transform, negated on a reversed block, so the shader needs no
// reversed flag of its own.
export const scoreGpu: GpuSpec<ScoreRegionData, ScoreParams, shader.Uniforms> =
  {
    shader,
    passes: [
      {
        ...slangPass({ id: 'score', mod: shader }),
        pack: data =>
          shader.packInstances(
            { startBp: data.starts, endBp: data.ends, score: data.scores },
            data.numFeatures,
          ),
      },
    ],
    uniforms: (
      block,
      clip,
      _region,
      { canvasWidth, canvasHeight, params },
    ) => ({
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      zero: 0,
      canvasWidth,
      canvasHeight,
      color: cssColorToABGR(params.color),
    }),
  }
// #endregion

// #region define
export const LinearScoreDisplay = defineDisplay({
  name: 'LinearScoreDisplay',
  displayName: 'Score display (example)',
  trackType: 'FeatureTrack',
  params,
  data: fetchScoreData,
  paint: drawScoreBlocks,
  gpu: scoreGpu,
})
// #endregion
