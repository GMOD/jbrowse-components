import {
  MAX_VISIBLE_CHEVRONS_PER_LINE,
  featureGlyphMarks,
} from '@jbrowse/plugin-canvas'

import { glyphRangeStart } from './multiwayRenderTypes.ts'

import type {
  GlyphLayer,
  LaneGlyphData,
  MultiWayRenderState,
} from './multiwayRenderTypes.ts'
import type { MarkFrame } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/** The frame a lane's glyph marks draw in: the stack's box and its scroll. */
export interface GlyphFrame extends MarkFrame {
  scrollY: number
}

/**
 * A lane's gene glyphs are the feature track's marks drawn under the stack's
 * own axis: positions are px rather than bp, so the block a layer draws over
 * runs from `glyphRangeStart` for the stack's width, one px per "bp". No
 * continuation markers — a lane is one unclipped band.
 */
export const MULTIWAY_GLYPH_MARKS = featureGlyphMarks<
  LaneGlyphData,
  GlyphFrame
>({
  params: (s, d) => ({ scrollY: s.scrollY, outlineColor: d.outlineColor }),
  maxChevronsPerLine: MAX_VISIBLE_CHEVRONS_PER_LINE,
  continuation: false,
})

export function glyphFrame(state: MultiWayRenderState): GlyphFrame {
  return {
    canvasWidth: state.width,
    canvasHeight: state.height,
    scrollY: state.scrollTopPx,
  }
}

export function glyphBlock(
  layer: GlyphLayer,
  state: MultiWayRenderState,
  regionKey: number,
): RenderBlock {
  const start = glyphRangeStart(layer, state)
  return {
    displayedRegionIndex: regionKey,
    start,
    end: start + state.width,
    screenStartPx: 0,
    screenEndPx: state.width,
    reversed: false,
  }
}
