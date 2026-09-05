import { defineMark } from '@jbrowse/render-core/marks'

import {
  arrowShape,
  continuationShape,
  lineShape,
  makeChevronShape,
  rectShape,
} from './featureGlyphShapes.ts'

import type { FeatureGlyphParams } from './featureGlyphShapes.ts'
import type { Mark, MarkFrame } from '@jbrowse/render-core/marks'

/**
 * The lanes the worker's feature layout ships, which every consumer of the
 * glyph set carries under these names: the canvas display's
 * `RegionRenderData` and multiway's `LaneGlyphData` both satisfy it.
 */
export interface FeatureGlyphLanes {
  rectPositions: Uint32Array
  rectYs: Float32Array
  rectHeights: Float32Array
  rectColors: Uint32Array
  rectDensityFade: Uint32Array
  rectStrands: Float32Array
  linePositions: Uint32Array
  lineYs: Float32Array
  lineHeights: Float32Array
  lineDirections: Int8Array
  lineColors: Uint32Array
  arrowXs: Uint32Array
  arrowYs: Float32Array
  arrowHeights: Float32Array
  arrowWidthsBp: Uint32Array
  arrowDirections: Int8Array
  arrowColors: Uint32Array
}

/**
 * The feature glyph set as a mark list, in paint order: lines, their chevrons
 * off the line buffer, rects, arrows, and — for a display whose blocks meet
 * the canvas edge — the continuation markers off the rect buffer.
 *
 * `maxChevronsPerLine` is the consumer's budget, not a limit: the chevron pass
 * shades that many slots per line whether or not a chevron lands in one.
 */
export function featureGlyphMarks<
  TRegion extends FeatureGlyphLanes,
  TState extends MarkFrame,
>(spec: {
  params: (state: TState, region: TRegion) => FeatureGlyphParams
  maxChevronsPerLine: number
  continuation: boolean
}): Mark<TRegion, TState>[] {
  const { params, maxChevronsPerLine, continuation } = spec
  const lineLens = (d: TRegion) => ({
    startEnd: d.linePositions,
    y: d.lineYs,
    height: d.lineHeights,
    direction: d.lineDirections,
    color: d.lineColors,
    count: d.lineYs.length,
  })
  const rectLens = (d: TRegion) => ({
    startEnd: d.rectPositions,
    y: d.rectYs,
    height: d.rectHeights,
    color: d.rectColors,
    densityFade: d.rectDensityFade,
    strand: d.rectStrands,
    count: d.rectYs.length,
  })
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
      channels: (d: TRegion) => ({
        x: d.arrowXs,
        y: d.arrowYs,
        height: d.arrowHeights,
        widthBp: d.arrowWidthsBp,
        direction: d.arrowDirections,
        color: d.arrowColors,
        count: d.arrowYs.length,
      }),
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
