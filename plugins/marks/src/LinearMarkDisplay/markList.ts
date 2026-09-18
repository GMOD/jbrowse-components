import { CANVAS_SEAM_PX } from '@jbrowse/render-core/canvas2dUtils'
import {
  barMark,
  defineMark,
  pointInsetPx,
  pointMark,
  spanMark,
} from '@jbrowse/render-core/marks'

import type { MarkShapeName } from './configSchema.ts'
import type { ZoomRange } from '@jbrowse/core/data_adapters/BaseAdapter/zoomRange'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type {
  Encoded,
  EncodedChannels,
  FacetSection,
  LaneName,
} from '@jbrowse/core/util/markEncoding'
import type {
  Mark,
  MarkFrame,
  MarkRamp,
  MarkShape,
  MarkValueScaleType,
} from '@jbrowse/render-core/marks'

/** An encoded layer, its Flatbush wrapped once at the commit. */
export interface StoredLayer extends EncodedChannels {
  flatbush?: Flatbush
}

/**
 * The lanes the worker fills for each shape. The encoder fills whichever of
 * `color` and `colorValue` the colour declaration calls for.
 */
export const SHAPE_LANES = {
  bar: ['y', 'row', 'color', 'colorValue', 'index'],
  point: ['y', 'row', 'color', 'colorValue', 'glyph', 'index'],
  span: ['row', 'color', 'index'],
} as const satisfies Record<MarkShapeName, readonly LaneName[]>

type ChannelLane = Exclude<LaneName, 'index'>

// Colour is checked apart from these, since either of two lanes carries it.
const SHAPE_VALUE_LANES = {
  bar: ['y'],
  point: ['y', 'glyph'],
  span: ['row', 'color'],
} as const satisfies Record<MarkShapeName, readonly ChannelLane[]>

// A payload fetched before a shape change packs nothing rather than a lane of
// zeros.
function hasLanes<L extends ChannelLane>(
  layer: StoredLayer,
  lanes: readonly L[],
): layer is StoredLayer & Encoded<L> {
  if (layer.color === undefined && layer.colorValue === undefined) {
    return false
  }
  for (const lane of lanes as readonly ChannelLane[]) {
    if (layer[lane] === undefined) {
      return false
    }
  }
  return true
}

function withLanes<L extends ChannelLane>(
  layer: StoredLayer | undefined,
  lanes: readonly L[],
) {
  return layer && hasLanes(layer, lanes) ? layer : undefined
}

/** One region's payload: `layers[i]` is mark `i`'s channels. */
export interface MarkRegionData {
  layers: StoredLayer[]
  /** The sections a facet stacked the layers' rows into. */
  facet?: FacetSection[]
  zoomRange?: ZoomRange
}

export interface MarkRenderState extends MarkFrame {
  domainY: [number, number]
  scaleTypeY: MarkValueScaleType
  /** The mark that declared `resolve: 'independent'`, on its own domain. */
  independentY?: {
    markIndex: number
    domain: [number, number]
    scaleType: MarkValueScaleType
  }
  /** Mark `i`'s colour ramp, undefined where its colour is not one. */
  colorRamps: (MarkRamp | undefined)[]
  bpPerPx: number
  origin: number
  minWidthPx: number
  pointDiameterPx: number
  /** The bands the plot is split into: the facet's, or the highest `row` any loaded layer carries plus one. */
  rowCount: number
}

export type DisplayMark = Mark<MarkRegionData, MarkRenderState>

/** A `marks` entry's shape and zoom range in bp per px, 0 for no bound. */
export interface MarkEntry {
  shape: MarkShapeName
  minBpPerPx: number
  maxBpPerPx: number
}

/**
 * The y scale mark `i` places its value through: its own where it declared an
 * independent axis, else the display's.
 */
export function markValueScale(state: MarkRenderState, i: number) {
  const { independentY } = state
  return independentY?.markIndex === i
    ? { domain: independentY.domain, scaleType: independentY.scaleType }
    : { domain: state.domainY, scaleType: state.scaleTypeY }
}

/** The px each row band gets: the plot split by the row count. */
export function markRowHeightPx(canvasHeight: number, rowCount: number) {
  return Math.max(1, Math.floor(canvasHeight / rowCount))
}

export function markDrawsAt(
  { minBpPerPx, maxBpPerPx }: MarkEntry,
  bpPerPx: number,
) {
  return (
    (minBpPerPx <= 0 || bpPerPx >= minBpPerPx) &&
    (maxBpPerPx <= 0 || bpPerPx < maxBpPerPx)
  )
}

// A pass id keys the instance buffer and texture, so two marks on one shape
// need two ids; pipelines are keyed by content, so the clone compiles nothing.
function withPassId<C, P>(shape: MarkShape<C, P>, id: string): MarkShape<C, P> {
  return { ...shape, id, pass: { ...shape.pass, id } }
}

/** One mark per `marks` entry, reading `layers[i]` inside its zoom range. */
export function buildMarkList(entries: readonly MarkEntry[]): DisplayMark[] {
  return entries.map((entry, i) => {
    const { shape } = entry
    const id = `${shape}#${i}`
    const enabled = (s: MarkRenderState) => markDrawsAt(entry, s.bpPerPx)
    switch (shape) {
      case 'bar': {
        return defineMark({
          shape: withPassId(barMark, id),
          channels: (d: MarkRegionData) =>
            withLanes(d.layers[i], SHAPE_VALUE_LANES.bar),
          params: (s: MarkRenderState) => ({
            ...markValueScale(s, i),
            ramp: s.colorRamps[i],
            origin: s.origin,
            minWidthPx: s.minWidthPx,
            seamPx: CANVAS_SEAM_PX,
            rowHeight: markRowHeightPx(s.canvasHeight, s.rowCount),
          }),
          texture: (s: MarkRenderState) => s.colorRamps[i]?.lut,
          enabled,
        })
      }
      case 'point': {
        return defineMark({
          shape: withPassId(pointMark, id),
          channels: (d: MarkRegionData) =>
            withLanes(d.layers[i], SHAPE_VALUE_LANES.point),
          params: (s: MarkRenderState) => ({
            ...markValueScale(s, i),
            ramp: s.colorRamps[i],
            diameterPx: s.pointDiameterPx,
            insetPx: pointInsetPx(s.pointDiameterPx),
            rowHeight: markRowHeightPx(s.canvasHeight, s.rowCount),
          }),
          texture: (s: MarkRenderState) => s.colorRamps[i]?.lut,
          enabled,
        })
      }
      case 'span': {
        return defineMark({
          shape: withPassId(spanMark, id),
          channels: (d: MarkRegionData) =>
            withLanes(d.layers[i], SHAPE_VALUE_LANES.span),
          params: (s: MarkRenderState) => ({
            rowHeight: markRowHeightPx(s.canvasHeight, s.rowCount),
            rowProportion: 1,
            minWidthPx: s.minWidthPx,
            seamPx: 0,
            scrollTop: 0,
          }),
          enabled,
        })
      }
    }
  })
}
