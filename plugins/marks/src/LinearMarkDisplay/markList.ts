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
import type {
  Mark,
  MarkFrame,
  MarkRamp,
  MarkShape,
  MarkValueScaleType,
} from '@jbrowse/render-core/marks'

/**
 * One encoded layer as the display stores it: the worker's channels — the
 * lanes its shape asked for — and the Flatbush wrapped once at the commit.
 */
export interface StoredLayer extends EncodedChannels {
  flatbush?: Flatbush
}

/**
 * The lanes each shape reads, which is what the worker is asked to fill:
 * `index` on every one, for the hover. `color` and `colorValue` are both
 * named where a shape resolves a ramp itself — the encoder fills whichever
 * the colour declaration calls for.
 */
export const SHAPE_LANES = {
  bar: ['y', 'color', 'colorValue', 'index'],
  point: ['y', 'color', 'colorValue', 'glyph', 'index'],
  span: ['row', 'color', 'index'],
} as const satisfies Record<MarkShapeName, readonly LaneName[]>

// The lanes a shape's channel type requires by name; its colour is checked
// apart, being either lane.
type ChannelLane = Exclude<LaneName, 'index'>

const SHAPE_VALUE_LANES = {
  bar: ['y'],
  point: ['y', 'glyph'],
  span: ['row', 'color'],
} as const satisfies Record<MarkShapeName, readonly ChannelLane[]>

// Whether a layer carries what a shape reads. A region whose payload predates
// a shape change packs nothing rather than a lane of zeros.
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
}

export interface MarkRenderState extends MarkFrame {
  domainY: [number, number]
  /** How the shared y domain is read, off the declared value scale. */
  scaleTypeY: MarkValueScaleType
  /**
   * The one mark reading its own y, where a mark declared
   * `resolve: 'independent'`: its domain is folded from its layers alone and
   * the chrome draws it as the right-hand axis.
   */
  independentY?: {
    markIndex: number
    domain: [number, number]
    scaleType: MarkValueScaleType
  }
  /**
   * Mark `i`'s quantitative colour scale, or undefined where its colour is
   * not a ramp: the domain unioned over the loaded regions and the LUT the
   * pass binds, so a pan that widens it writes one uniform and no bytes.
   */
  colorRamps: (MarkRamp | undefined)[]
  /** The view's zoom, what a mark's range is checked against. */
  bpPerPx: number
  origin: number
  minWidthPx: number
  pointDiameterPx: number
  /** Bands a span mark stacks into: the highest `row` any loaded layer carries, plus one. */
  rowCount: number
}

export type DisplayMark = Mark<MarkRegionData, MarkRenderState>

/**
 * One `marks` entry as the list is built from it: the shape, and the zoom
 * range it draws in, in bp per px, where 0 is no bound.
 */
export interface MarkEntry {
  shape: MarkShapeName
  minBpPerPx: number
  maxBpPerPx: number
}

/**
 * The y scale mark `i` places its value through: the display's shared one,
 * or its own where it declared an independent axis. Every reader of a
 * mark's domain — the shapes' uniforms and the hit test's value window —
 * goes through this, so the two cannot disagree.
 */
export function markValueScale(state: MarkRenderState, i: number) {
  const { independentY } = state
  return independentY?.markIndex === i
    ? { domain: independentY.domain, scaleType: independentY.scaleType }
    : { domain: state.domainY, scaleType: state.scaleTypeY }
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

// A pass id keys the pipeline and the instance buffer, so two marks on one
// shape need two ids — the shape's own, suffixed by the mark's index.
function withPassId<C, P>(shape: MarkShape<C, P>, id: string): MarkShape<C, P> {
  return { ...shape, id, pass: { ...shape.pass, id } }
}

/**
 * The mark list a `marks` config declares: mark `i` reads `layers[i]`, places
 * its value through the scale `markValueScale` hands it, and is off outside
 * its zoom range — for the draw, the hover and the highlight alike.
 */
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
            rowHeight: s.canvasHeight / s.rowCount,
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
