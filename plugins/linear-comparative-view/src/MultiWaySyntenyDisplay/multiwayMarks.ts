import {
  MAX_VISIBLE_CHEVRONS_PER_LINE,
  featureGlyphMarks,
} from '@jbrowse/plugin-canvas'
import { CANVAS_SEAM_PX } from '@jbrowse/render-core/canvas2dUtils'
import { barMark, defineMark } from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { syntenyRibbonMarks } from '../LinearSyntenyDisplay/syntenyRibbonMarks.ts'
import { laneLayerBlockSpan } from './laneLayers.ts'
import {
  MULTIWAY_OVERDRAW_PX,
  glyphBlockRange,
  laneMapOf,
  ribbonParams,
} from './multiwayRenderTypes.ts'

import type {
  MultiWayCell,
  MultiWayLayer,
  MultiWayRenderState,
} from './multiwayRenderTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

function ribbonLayerOf(layer: MultiWayLayer | undefined) {
  return layer?.kind === 'outline'
    ? layer.ribbon
    : layer?.kind === 'ribbons'
      ? layer
      : undefined
}

/** Glyph positions are px, not bp, so a lane's block is `glyphBlockRange`. */
export const MULTIWAY_MARKS = [
  ...syntenyRibbonMarks<MultiWayCell, MultiWayRenderState>({
    ribbons: cell => (cell.kind === 'ribbons' ? cell.data : undefined),
    outline: cell => (cell.kind === 'outline' ? cell : undefined),
    params: (state, cell, block) => {
      const ribbon = ribbonLayerOf(state.layers.get(block.displayedRegionIndex))
      return ribbon && (cell.kind === 'ribbons' || cell.kind === 'outline')
        ? {
            track: ribbonParams(ribbon, state),
            base0: cell.data.base0,
            base1: cell.data.base1,
            overdrawPx: MULTIWAY_OVERDRAW_PX,
            groundColor: state.groundColor,
          }
        : undefined
    },
  }),
  ...featureGlyphMarks<MultiWayCell, MultiWayRenderState>({
    glyphs: cell => (cell.kind === 'glyphs' ? cell.data : undefined),
    params: (state, cell) => ({
      scrollY: state.scrollTopPx,
      outlineColor: cell.kind === 'glyphs' ? (cell.data.outlineColor ?? 0) : 0,
    }),
    maxChevronsPerLine: MAX_VISIBLE_CHEVRONS_PER_LINE,
    continuation: false,
  }),
  defineMark({
    shape: barMark,
    channels: (cell: MultiWayCell) =>
      cell.kind === 'bars' ? cell.data : undefined,
    params: (state: MultiWayRenderState, _cell: MultiWayCell, block) => {
      const layer = state.layers.get(block.displayedRegionIndex)
      const bars = layer?.kind === 'bars' ? layer : undefined
      return {
        domain: bars?.domain ?? [0, 1],
        origin: bars?.origin ?? 0,
        minWidthPx: 0,
        seamPx: CANVAS_SEAM_PX,
        rowHeight: bars?.height ?? 0,
        rowOffsetPx: (bars?.top ?? 0) - state.scrollTopPx,
      }
    },
  }),
]

/** Glyphs read x off the block's range; ribbons read theirs through `panPx`. */
function multiwayBlock(
  key: number,
  layer: MultiWayLayer,
  state: MultiWayRenderState,
): RenderBlock {
  const { canvasWidth } = state
  if (layer.kind === 'bars') {
    return {
      displayedRegionIndex: key,
      start: layer.start,
      end: layer.end,
      ...laneLayerBlockSpan(
        layer.px,
        laneMapOf(state, layer.row),
        state.dragOffsetPx,
      ),
    }
  } else if (layer.kind === 'glyphs') {
    return {
      displayedRegionIndex: key,
      ...glyphBlockRange(layer, state),
      screenStartPx: 0,
      screenEndPx: canvasWidth,
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
