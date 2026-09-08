import { defineMark } from '@jbrowse/render-core/marks'

import {
  arrowShape,
  continuationShape,
  lineShape,
  makeChevronShape,
  rectShape,
} from './featureGlyphShapes.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { FeatureGlyphParams } from './featureGlyphShapes.ts'
import type { Mark, MarkFrame } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * The feature glyph set as a mark list, in paint order: lines, their chevrons
 * off the line buffer, rects, arrows, and — for a display whose blocks meet
 * the canvas edge — the continuation markers off the rect buffer.
 *
 * `glyphs` is the lens onto the region's glyph lanes, so a display whose cells
 * are a union can put these marks beside others over one list: the multi-way
 * stack's lanes and its ribbon gutters are cells of one map, and the lens
 * answers `undefined` for a cell these marks have nothing in.
 *
 * `maxChevronsPerLine` is the consumer's budget, not a limit: the chevron pass
 * shades that many slots per line whether or not a chevron lands in one.
 */
export function featureGlyphMarks<TRegion, TState extends MarkFrame>(spec: {
  glyphs: (region: TRegion) => RegionRenderData | undefined
  params: (
    state: TState,
    region: TRegion,
    block: RenderBlock,
  ) => FeatureGlyphParams
  maxChevronsPerLine: number
  continuation: boolean
}): Mark<TRegion, TState>[] {
  const { glyphs, params, maxChevronsPerLine, continuation } = spec
  const lineLens = (region: TRegion) => {
    const d = glyphs(region)
    return (
      d && {
        startEnd: d.linePositions,
        y: d.lineYs,
        height: d.lineHeights,
        direction: d.lineDirections,
        color: d.lineColors,
        count: d.lineYs.length,
      }
    )
  }
  const rectLens = (region: TRegion) => {
    const d = glyphs(region)
    return (
      d && {
        startEnd: d.rectPositions,
        y: d.rectYs,
        height: d.rectHeights,
        color: d.rectColors,
        densityFade: d.rectDensityFade,
        strand: d.rectStrands,
        count: d.rectYs.length,
      }
    )
  }
  const line = defineMark({ shape: lineShape, channels: lineLens, params })
  const rect = defineMark({ shape: rectShape, channels: rectLens, params })
  const marks = [
    line,
    defineMark({
      shape: makeChevronShape(maxChevronsPerLine),
      channels: lineLens,
      params,
      bufferOf: line,
    }),
    rect,
    defineMark({
      shape: arrowShape,
      channels: (region: TRegion) => {
        const d = glyphs(region)
        return (
          d && {
            x: d.arrowXs,
            y: d.arrowYs,
            height: d.arrowHeights,
            widthBp: d.arrowWidthsBp,
            direction: d.arrowDirections,
            color: d.arrowColors,
            count: d.arrowYs.length,
          }
        )
      },
      params,
    }),
  ]
  if (continuation) {
    marks.push(
      defineMark({
        shape: continuationShape,
        channels: rectLens,
        params,
        bufferOf: rect,
      }),
    )
  }
  return marks
}
