import { createCanvas2DBackend } from '@jbrowse/core/gpu/createRenderingBackend'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'

import { drawSequenceBlocks } from './drawSequence.ts'

import type { DrawSequenceState } from './drawSequence.ts'
import type { SequenceRegionData } from '../model.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

// Sequence is text — there is no GPU shader path, so this is Canvas2D-only
// (no `createRenderingBackend` HAL ladder). It plugs into the shared
// RenderLifecycle/DisplayChrome machinery like every other display: the model
// owns `sequenceData` and `renderState`, this backend just paints the visible
// blocks each frame. The base `renderBlocks` runs `prepareCanvas`; this `draw`
// adds the opaque white background that sequence text needs before painting.
export class Canvas2DSequenceRenderer extends Canvas2DPerRegionRenderingBackend<
  SequenceRegionData,
  DrawSequenceState
> {
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, SequenceRegionData>,
    state: DrawSequenceState,
  ) {
    this.ctx.fillStyle = '#fff'
    this.ctx.fillRect(0, 0, state.canvasWidth, state.canvasHeight)
    drawSequenceBlocks(this.ctx, regions, blocks, state)
  }
}

export function SequenceRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DSequenceRenderer(c))
}
