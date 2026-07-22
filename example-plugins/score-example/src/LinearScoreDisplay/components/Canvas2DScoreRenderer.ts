import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawScoreBlocks } from './drawScore.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The base class owns renderBlocks (DPR-aware canvas sizing, then calls draw);
// this subclass implements only the pure paint step. Runs both as the WebGPU/
// WebGL2 fallback and as the SVG-export path.
export class Canvas2DScoreRenderer extends Canvas2DPerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
> {
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, ScoreRegionData>,
    state: ScoreRenderState,
  ) {
    drawScoreBlocks(this.ctx, regions, blocks, state)
  }
}
