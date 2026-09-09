import {
  barMark,
  defineMark,
  pointMark,
  spanMark,
} from '@jbrowse/render-core/marks'

import type { MarkShapeName } from './configSchema.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type {
  Encoded,
  EncodedChannels,
  LaneName,
} from '@jbrowse/core/util/markEncoding'
import type { Mark, MarkFrame, MarkShape } from '@jbrowse/render-core/marks'

/**
 * One encoded layer as the display stores it: the worker's channels — the
 * lanes its shape asked for — and the Flatbush wrapped once at the commit.
 */
export interface StoredLayer extends EncodedChannels {
  flatbush?: Flatbush
}

/**
 * The lanes each shape reads, which is what the worker is asked to fill:
 * `index` on every one, for the hover.
 */
export const SHAPE_LANES = {
  bar: ['y', 'color', 'index'],
  point: ['y', 'color', 'glyph', 'index'],
  span: ['row', 'color', 'index'],
} as const satisfies Record<MarkShapeName, readonly LaneName[]>

// Whether a layer carries the lanes a shape reads. A region whose payload
// predates a shape change packs nothing rather than a lane of zeros.
function hasLanes<L extends LaneName>(
  layer: StoredLayer,
  lanes: readonly L[],
): layer is StoredLayer & Encoded<L> {
  for (const lane of lanes as readonly LaneName[]) {
    if (lane !== 'index' && layer[lane] === undefined) {
      return false
    }
  }
  return true
}

function withLanes<L extends LaneName>(
  layer: StoredLayer | undefined,
  lanes: readonly L[],
) {
  return layer && hasLanes(layer, lanes) ? layer : undefined
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
  /** Bands a span mark stacks into: the highest `row` any loaded layer carries, plus one. */
  rowCount: number
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
          channels: (d: MarkRegionData) =>
            withLanes(d.layers[i], SHAPE_LANES.bar),
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
          channels: (d: MarkRegionData) =>
            withLanes(d.layers[i], SHAPE_LANES.point),
          params: (s: MarkRenderState) => ({
            domain: s.domainY,
            diameterPx: s.pointDiameterPx,
          }),
        })
      }
      case 'span': {
        return defineMark({
          shape: withPassId(spanMark, id),
          channels: (d: MarkRegionData) =>
            withLanes(d.layers[i], SHAPE_LANES.span),
          params: (s: MarkRenderState) => ({
            rowHeight: s.canvasHeight / s.rowCount,
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
