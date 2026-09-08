import {
  MAX_VISIBLE_CHEVRONS_PER_LINE,
  featureGlyphMarks,
} from '@jbrowse/plugin-canvas'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { syntenyRibbonMarks } from '../LinearSyntenyDisplay/syntenyRibbonMarks.ts'
import { glyphRangeStart, ribbonParams } from './multiwayRenderTypes.ts'

import type {
  MultiWayCell,
  MultiWayLayer,
  MultiWayRenderState,
} from './multiwayRenderTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// The gutter a layer draws ribbons into: its own, for a ribbon layer, and the
// one it traces for an outline layer.
function ribbonLayerOf(layer: MultiWayLayer | undefined) {
  return layer?.kind === 'outline'
    ? layer.ribbon
    : layer?.kind === 'ribbons'
      ? layer
      : undefined
}

/**
 * The stack as one mark list over one cell union: the synteny ribbons for the
 * gutters and the feature track's glyph marks for the lanes. A region key holds
 * a ribbon cell, an outline cell or a lane's glyph buffers, never two of them,
 * and each mark's `channels` lens is what says which — so the kind test is
 * stated once per mark rather than once per backend.
 *
 * A lane's gene glyphs are drawn under the stack's own axis: positions are px
 * rather than bp, so the block a layer draws over runs from `glyphRangeStart`
 * for the stack's width, one px per "bp". No continuation markers — a lane is
 * one unclipped band.
 */
export const MULTIWAY_MARKS = [
  ...syntenyRibbonMarks<MultiWayCell, MultiWayRenderState>({
    ribbons: cell => (cell.kind === 'ribbons' ? cell.data : undefined),
    outline: cell => (cell.kind === 'outline' ? cell : undefined),
    params: (state, cell, block) => {
      const ribbon = ribbonLayerOf(state.layers.get(block.displayedRegionIndex))
      return ribbon && cell.kind !== 'glyphs'
        ? {
            track: ribbonParams(ribbon, state),
            base0: cell.data.base0,
            base1: cell.data.base1,
            overdrawPx: 0,
            groundColor: state.groundColor,
          }
        : undefined
    },
  }),
  ...featureGlyphMarks<MultiWayCell, MultiWayRenderState>({
    glyphs: cell => (cell.kind === 'glyphs' ? cell.data : undefined),
    params: (state, cell) => ({
      scrollY: state.scrollTopPx,
      outlineColor: cell.kind === 'glyphs' ? cell.data.outlineColor : 0,
    }),
    maxChevronsPerLine: MAX_VISIBLE_CHEVRONS_PER_LINE,
    continuation: false,
  }),
]

/**
 * One layer's block. A lane's glyphs read their x off the block's own range, so
 * theirs carries the layer transform; a gutter's ribbons read theirs off the
 * payload through `panPx`, so theirs is the canvas-wide identity every synteny
 * block is.
 */
function multiwayBlock(
  key: number,
  layer: MultiWayLayer,
  state: MultiWayRenderState,
): RenderBlock {
  const { canvasWidth } = state
  if (layer.kind === 'glyphs') {
    const start = glyphRangeStart(layer, state)
    return {
      displayedRegionIndex: key,
      start,
      end: start + canvasWidth,
      screenStartPx: 0,
      screenEndPx: canvasWidth,
      reversed: false,
    }
  } else {
    return canvasWideBlock(key, canvasWidth)
  }
}

export function multiwayBlocks(state: MultiWayRenderState) {
  return [...state.layers].map(([key, layer]) =>
    multiwayBlock(key, layer, state),
  )
}
