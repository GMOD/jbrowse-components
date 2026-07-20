import { createCanvas2DBackend } from '@jbrowse/render-core/createRenderingBackend'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawSequenceBlocks } from './drawSequence.ts'

import type { SequenceRegionData } from '../model.ts'
import type { DrawSequenceState } from './drawSequence.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// Sequence is text — there is no GPU shader path, so this is Canvas2D-only
// (no `createRenderingBackend` HAL ladder). It plugs into the shared
// RenderLifecycle/DisplayChrome machinery like every other display: the model
// owns `sequenceData` and `renderState`, this backend just paints the visible
// blocks each frame. The per-base/per-codon fills in drawSequenceBlocks cover
// every visible pixel, so no full-canvas background fill is needed.
export class Canvas2DSequenceRenderer extends Canvas2DPerRegionRenderingBackend<
  SequenceRegionData,
  DrawSequenceState
> {
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, SequenceRegionData>,
    state: DrawSequenceState,
  ) {
    drawSequenceBlocks(this.ctx, regions, blocks, state)
  }
}

export function SequenceRenderer(canvas: HTMLCanvasElement) {
  return createCanvas2DBackend(canvas, c => new Canvas2DSequenceRenderer(c))
}
