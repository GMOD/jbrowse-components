import { CANVAS_SEAM_PX } from '@jbrowse/render-core/canvas2dUtils'
import {
  barMark,
  defineMark,
  pointMark,
  spanMark,
} from '@jbrowse/render-core/marks'

import type { MarkShapeName } from './configSchema.ts'
import type { ZoomRange } from '@jbrowse/core/data_adapters/BaseAdapter/zoomRange'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type {
  CoreEncodeFeaturesArgs,
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
  /**
   * The request the layers came back under, which `CoreGetEncodedFeature`
   * takes again to name the feature behind an instance. Absent on a payload no
   * worker fetch produced, the density sidecar's.
   */
  request?: Omit<CoreEncodeFeaturesArgs, 'byteLimit'>
  /** The sections a facet stacked the layers' rows into. */
  facet?: FacetSection[]
  zoomRange?: ZoomRange
}

export interface MarkRenderState extends MarkFrame {
  /** The display's one y scale, which every valued mark is placed through. */
  domainY: [number, number]
  scaleTypeY: MarkValueScaleType
  /** Mark `i`'s colour ramp, undefined where its colour is not one. */
  colorRamps: (MarkRamp | undefined)[]
  bpPerPx: number
  origin: number
  minWidthPx: number
  pointDiameterPx: number
  /** The px the y scale stands in from both ends of its band, the axis's own. */
  valueInsetPx: number
  /** The bands the plot is split into: the facet's, or the highest `row` any loaded layer carries plus one. */
  rowCount: number
}

export type DisplayMark = Mark<MarkRegionData, MarkRenderState>

/** A `marks` entry's shape and zoom range in bp per px, 0 for no bound. */
export interface MarkEntry {
  shape: MarkShapeName
  minBpPerPx: number
  maxBpPerPx: number
  /** Whether the mark has somewhere to stand: a bar or point naming no `y` draws nowhere. */
  placed: boolean
}

/** The px each row band gets: the plot split by the row count. */
export function markRowHeightPx(canvasHeight: number, rowCount: number) {
  return Math.max(1, Math.floor(canvasHeight / rowCount))
}

export function markDrawsAt(
  { minBpPerPx, maxBpPerPx, placed }: MarkEntry,
  bpPerPx: number,
) {
  return (
    placed &&
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
            domain: s.domainY,
            scaleType: s.scaleTypeY,
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
            domain: s.domainY,
            scaleType: s.scaleTypeY,
            ramp: s.colorRamps[i],
            diameterPx: s.pointDiameterPx,
            insetPx: s.valueInsetPx,
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
