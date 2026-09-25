import { CANVAS_SEAM_PX } from '@jbrowse/render-core/canvas2dUtils'
import {
  barMark,
  defineMark,
  linkMark,
  pointMark,
  spanMark,
} from '@jbrowse/render-core/marks'

import type { MarkType } from './configSchema.ts'
import type { LinkShape } from './markVocabulary.ts'
import type { ZoomRange } from '@jbrowse/core/data_adapters/BaseAdapter/zoomRange'
import type {
  CoreGetEncodedLayersArgs,
  EncodedChannels,
  FacetSection,
  HitIndexed,
  LaneName,
} from '@jbrowse/core/util/markEncoding'
import type {
  LinkRegion,
  LinkSizeScale,
  Mark,
  MarkFrame,
  MarkRamp,
  MarkShape,
  MarkValueScaleType,
} from '@jbrowse/render-core/marks'

export type StoredLayer = HitIndexed<EncodedChannels> & {
  /**
   * The displayed region each `x2` lies on, resolved on the main thread from
   * the worker's `x2Ref` against the view's regions; `LINK_NO_REGION` for
   * none. Present on a link's layer alone.
   */
  x2Region?: Uint32Array
}

type ChannelLane = Exclude<LaneName, 'index'> | 'x2Region'

// Colour is checked apart from these, since either of two lanes carries it.
const MARK_VALUE_LANES = {
  bar: ['y'],
  point: ['y', 'glyph'],
  span: ['row', 'color'],
  link: ['x2Region'],
} as const satisfies Record<Exclude<MarkType, 'text'>, readonly ChannelLane[]>

// A payload fetched before a mark type change packs nothing rather than a lane of
// zeros.
function hasLanes<L extends ChannelLane>(
  layer: StoredLayer,
  lanes: readonly L[],
): layer is StoredLayer & Required<Pick<StoredLayer, L>> {
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
  request?: Omit<CoreGetEncodedLayersArgs, 'byteLimit'>
  /** The sections a facet stacked the layers' rows into. */
  facet?: FacetSection[]
  zoomRange?: ZoomRange
}

export interface MarkRenderState extends MarkFrame {
  /** The display's one y scale, which every valued mark is placed through. */
  domainY: [number, number]
  scaleTypeY: MarkValueScaleType
  /** `scales.y.symlogConstant` resolved against `domainY`, as the axis resolves it. */
  symlogConstantY: number
  /** Mark `i`'s colour ramp, undefined where its colour is not one. */
  colorRamps: (MarkRamp | undefined)[]
  bpPerPx: number
  origin: number
  minWidthPx: number
  /** Mark `i`'s `size`: a point's diameter or a link's stroke in px. */
  markSizes: number[]
  /** Mark `i`'s size scale, where its `encoding.size` names a field. */
  sizeScales: (LinkSizeScale | undefined)[]
  /**
   * The view's displayed regions as a link's feet place through them, empty
   * where no mark is a link.
   */
  linkRegions: readonly LinkRegion[]
  /** The px the y scale stands in from both ends of its band, the axis's own. */
  valueInsetPx: number
  /** The bands the plot is split into: the facet's, or the highest `row` any loaded layer carries plus one. */
  rowCount: number
}

/**
 * A `marks` entry's shape bound to the display's payload, with the entry it
 * draws: the list skips a text mark, which has no shape, so a mark's position
 * in the list is not its index in `marks` or in a region's `layers`.
 */
export interface DisplayMark extends Mark<MarkRegionData, MarkRenderState> {
  markIndex: number
}

/** A `marks` entry's type and zoom range in bp per px, 0 for no bound. */
export interface MarkEntry {
  type: MarkType
  minBpPerPx: number
  maxBpPerPx: number
  /** Whether the mark has somewhere to stand: a bar or point naming no `y` draws nowhere. */
  placed: boolean
  /** Whether the mark names a `y` to stand at; a text or link without one stands by its band. */
  valued: boolean
  /** How a link naming no `y` rises. */
  linkShape: LinkShape
}

/**
 * A `marks` entry as the text layer places it: the entry, and the two facts
 * the layer reads off the config beyond it. Apart from `MarkEntry` so the mark
 * list, which the GPU backend is keyed on, never depends on a slot only a
 * label reads.
 */
export interface TextMarkEntry extends MarkEntry {
  /**
   * Whether the config writes the mark's colour, or leaves it at the mark
   * default. Left at the default, a label prints in the surface's text colour.
   */
  ownColor: boolean
}

/**
 * The value mark `mark`'s instances stand at over `pos`, by the row each is
 * drawn in, the highest where two in one row cover it.
 */
export function rowValuesAt(
  region: MarkRegionData,
  mark: number,
  pos: number,
): Map<number, number> {
  const values = new Map<number, number>()
  const layer = region.layers[mark]
  const { y, row } = layer ?? {}
  if (layer && y && row) {
    for (let i = 0; i < layer.count; i++) {
      if (layer.x[i]! <= pos && pos < layer.x2[i]!) {
        const had = values.get(row[i]!)
        if (had === undefined || y[i]! > had) {
          values.set(row[i]!, y[i]!)
        }
      }
    }
  }
  return values
}

/**
 * The px each row band gets: the plot split by the row count, in whole px
 * while every row has one, and a fraction of one past that, so the rows
 * squash to fit the plot rather than run off its foot.
 */
export function markRowHeightPx(canvasHeight: number, rowCount: number) {
  return rowCount > canvasHeight
    ? canvasHeight / rowCount
    : Math.max(1, Math.floor(canvasHeight / rowCount))
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

/**
 * The zoom nearest `bpPerPx` inside a mark's range: the view's own where the
 * mark draws, and the bound it will next draw at where it does not, which
 * holds still while the view zooms outside the range.
 */
export function zoomInRange(
  { minBpPerPx, maxBpPerPx }: Pick<MarkEntry, 'minBpPerPx' | 'maxBpPerPx'>,
  bpPerPx: number,
) {
  const floored = minBpPerPx > 0 ? Math.max(bpPerPx, minBpPerPx) : bpPerPx
  return maxBpPerPx > 0 ? Math.min(floored, maxBpPerPx) : floored
}

// A pass id keys the instance buffer and texture, so two marks of one type
// need two ids; pipelines are keyed by content, so the clone compiles nothing.
function withPassId<C, P>(shape: MarkShape<C, P>, id: string): MarkShape<C, P> {
  return { ...shape, id, pass: { ...shape.pass, id } }
}

function withMarkIndex(
  mark: Mark<MarkRegionData, MarkRenderState>,
  markIndex: number,
): DisplayMark {
  return Object.assign(mark, { markIndex })
}

/**
 * One mark per `marks` entry with a shape, reading `layers[i]` inside its
 * zoom range. A text mark is the text layer's and takes no place here.
 */
export function buildMarkList(entries: readonly MarkEntry[]): DisplayMark[] {
  return entries.flatMap((entry, i) => {
    const mark = shapeMark(entry, i)
    return mark ? [withMarkIndex(mark, i)] : []
  })
}

function shapeMark(entry: MarkEntry, i: number) {
  const { type } = entry
  const id = `${type}#${i}`
  const enabled = (s: MarkRenderState) => markDrawsAt(entry, s.bpPerPx)
  switch (type) {
    case 'text': {
      return undefined
    }
    case 'bar': {
      return defineMark({
        shape: withPassId(barMark, id),
        channels: (d: MarkRegionData) =>
          withLanes(d.layers[i], MARK_VALUE_LANES.bar),
        params: (s: MarkRenderState) => ({
          domain: s.domainY,
          scaleType: s.scaleTypeY,
          symlogConstant: s.symlogConstantY,
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
          withLanes(d.layers[i], MARK_VALUE_LANES.point),
        params: (s: MarkRenderState) => ({
          domain: s.domainY,
          scaleType: s.scaleTypeY,
          symlogConstant: s.symlogConstantY,
          ramp: s.colorRamps[i],
          diameterPx: s.markSizes[i]!,
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
          withLanes(d.layers[i], MARK_VALUE_LANES.span),
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
    case 'link': {
      return defineMark({
        shape: withPassId(linkMark, id),
        channels: (d: MarkRegionData) =>
          withLanes(d.layers[i], MARK_VALUE_LANES.link),
        params: (s: MarkRenderState) => ({
          domain: s.domainY,
          scaleType: s.scaleTypeY,
          symlogConstant: s.symlogConstantY,
          ramp: s.colorRamps[i],
          regions: s.linkRegions,
          linkShape: entry.linkShape,
          valued: entry.valued,
          sizePx: s.markSizes[i]!,
          sizeScale: s.sizeScales[i],
          insetPx: s.valueInsetPx,
          rowHeight: markRowHeightPx(s.canvasHeight, s.rowCount),
        }),
        texture: (s: MarkRenderState) => s.colorRamps[i]?.lut,
        enabled,
      })
    }
  }
}
