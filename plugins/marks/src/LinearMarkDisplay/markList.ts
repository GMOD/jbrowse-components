import {
  barMark,
  defineMark,
  pointMark,
  spanMark,
} from '@jbrowse/render-core/marks'

import type { MarkShapeName } from './configSchema.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { EncodedChannels } from '@jbrowse/core/util/markEncoding'
import type { Mark, MarkFrame, MarkShape } from '@jbrowse/render-core/marks'

/**
 * One encoded layer as the display stores it: the worker's channels, the
 * Flatbush wrapped once at the commit, and — for a span mark — the row
 * channel the shape reads, all zeros because a span here is a band across the
 * whole plot rather than a row in a stack.
 */
export interface StoredLayer extends EncodedChannels {
  flatbush?: Flatbush
  row?: Uint32Array
}

/** One region's payload: `layers[i]` is mark `i`'s channels. */
export interface MarkRegionData {
  layers: StoredLayer[]
}

export interface MarkRenderState extends MarkFrame {
  domainY: [number, number]
  origin: number
  minWidthPx: number
  pointDiameterPx: number
}

export type DisplayMark = Mark<MarkRegionData, MarkRenderState>

// A pass id keys the pipeline and the instance buffer, so two marks on one
// shape need two ids — the shape's own, suffixed by the mark's index.
function withPassId<C, P>(shape: MarkShape<C, P>, id: string): MarkShape<C, P> {
  return { ...shape, id, pass: { ...shape.pass, id } }
}

/**
 * The mark list a `marks` config declares: mark `i` reads `layers[i]` and
 * every shape places its value through the one `domainY`.
 */
export function buildMarkList(shapes: readonly MarkShapeName[]): DisplayMark[] {
  return shapes.map((shape, i) => {
    const id = `${shape}#${i}`
    switch (shape) {
      case 'bar': {
        return defineMark({
          shape: withPassId(barMark, id),
          channels: (d: MarkRegionData) => d.layers[i],
          params: (s: MarkRenderState) => ({
            domain: s.domainY,
            origin: s.origin,
            minWidthPx: s.minWidthPx,
          }),
        })
      }
      case 'point': {
        return defineMark({
          shape: withPassId(pointMark, id),
          channels: (d: MarkRegionData) => d.layers[i],
          params: (s: MarkRenderState) => ({
            domain: s.domainY,
            diameterPx: s.pointDiameterPx,
          }),
        })
      }
      case 'span': {
        return defineMark({
          shape: withPassId(spanMark, id),
          channels: (d: MarkRegionData) => {
            const l = d.layers[i]
            return l?.row
              ? { x: l.x, x2: l.x2, row: l.row, color: l.color, count: l.count }
              : undefined
          },
          params: (s: MarkRenderState) => ({
            rowHeight: s.canvasHeight,
            rowProportion: 1,
            minWidthPx: s.minWidthPx,
            seamPx: 0,
            scrollTop: 0,
          }),
        })
      }
    }
  })
}
