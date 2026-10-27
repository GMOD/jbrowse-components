import { CANVAS_SEAM_PX } from '@jbrowse/render-core/canvas2dUtils'
import {
  barMark,
  defineMark,
  isThreshold,
  lineMarkOf,
  linkMark,
  pointMark,
  ruleMark,
  spanMark,
  withPassId,
} from '@jbrowse/render-core/marks'

import { layerColorScale } from './markColor.ts'
import { MARK_SPECS } from './markSpecs.ts'
import { DEFAULT_LINE_INTERPOLATE } from './markVocabulary.ts'

import type { MarkType } from './configSchema.ts'
import type { HeldColor } from './markColor.ts'
import type { MarkSpec } from './markSpecs.ts'
import type { LineInterpolation } from './markVocabulary.ts'
import type { RowCompareBy } from './rowCompare.ts'
import type { ZoomRange } from '@jbrowse/core/data_adapters/BaseAdapter/zoomRange'
import type {
  CoreGetEncodedLayersArgs,
  EncodedChannels,
  FacetSection,
  HitIndexed,
  LaneName,
} from '@jbrowse/core/util/markEncoding'
import type {
  LinkParams,
  LinkRegion,
  LinkSizeScale,
  Mark,
  MarkColorScale,
  MarkFrame,
  MarkShape,
  MarkValueScaleType,
  RowTable,
} from '@jbrowse/render-core/marks'

export type StoredLayer = HitIndexed<EncodedChannels> &
  HeldColor & {
    /**
     * The displayed region each `x2` lies on, resolved on the main thread from
     * the worker's `x2Ref` against the view's regions; `LINK_NO_REGION` for
     * none. Present on a link's layer alone.
     */
    x2Region?: Uint32Array
  }

type ChannelLane = Exclude<LaneName, 'index'> | 'x2Region'

// a bar or rect narrower than a pixel still paints one
export const MIN_MARK_WIDTH_PX = 1

// Color is checked apart from these, since either of two lanes carries it.
const MARK_VALUE_LANES = {
  bar: ['y'],
  point: ['y', 'glyph'],
  rule: ['y'],
  line: ['y'],
  rect: ['row'],
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
   * worker fetch produced.
   */
  request?: Omit<CoreGetEncodedLayersArgs, 'byteLimit'>
  /** The sections a facet stacked the layers' rows into. */
  facet?: FacetSection[]
  zoomRange?: ZoomRange
  /** What the adapter said about the region that the plot cannot show. */
  notices?: string[]
  /** What the adapter read off the region's features, under names of its own. */
  facts?: Record<string, unknown>
  /** The `filter` fields no fetched feature carries. */
  unreadFilterFields?: string[]
}

export interface MarkRenderState extends MarkFrame {
  /** The display's one y scale, which every valued mark is placed through. */
  domainY: [number, number]
  scaleTypeY: MarkValueScaleType
  /** `encoding.y.scale.constant` resolved against `domainY`, as the axis resolves it. */
  symlogConstantY: number
  /** Mark `i`'s color scale, a ramp or a threshold, undefined where its color is neither. */
  colorScales: (MarkColorScale | undefined)[]
  /** Whether mark `i`'s color field is its plotted `y`, which a line's threshold colors along. */
  colorsFromY: boolean[]
  bpPerPx: number
  origin: number
  minWidthPx: number
  /** Mark `i`'s px number: a point's `encoding.size`, a rule's, a line's or a link's `encoding.strokeWidth`. */
  markSizes: number[]
  /** Mark `i`'s size scale, where its `encoding.strokeWidth` names a field. */
  sizeScales: (LinkSizeScale | undefined)[]
  /**
   * The view's displayed regions as a link's feet place through them, empty
   * where no mark is a link.
   */
  linkRegions: readonly LinkRegion[]
  /** The px the y scale stands in from both ends of its band, the axis's own. */
  valueInsetPx: number
  /** The px each row band is drawn in, the display's `effectiveRowHeight`. */
  rowHeight: number
  /** Each mark's fraction of its band, which a rect fills. */
  rowProportions: number[]
  /** The px the rows are scrolled up by, 0 wherever they fit the plot. */
  scrollTop: number
  /** What each `row` key draws on under `rows` or a facet; absent, `row` is the band. */
  rowTable?: RowTable
}

/**
 * A `marks` entry's shape bound to the display's payload, with the entry it
 * draws: the list skips a text mark, which has no shape, so a mark's position
 * in the list is not its index in `marks` or in a region's `layers`.
 */
export interface DisplayMark extends Mark<MarkRegionData, MarkRenderState> {
  markIndex: number
  /** How the mark answers a hover: its layer's hit index, or its rows. */
  hitBy: MarkSpec['hit']
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
  /** How a link rises, in the link shape's words. */
  linkShape: LinkParams['linkShape']
  /** How a line joins its values; `step` when absent. */
  interpolate?: LineInterpolation
}

/**
 * A `marks` entry as the text layer places it: the entry, and the two facts
 * the layer reads off the config beyond it. Apart from `MarkEntry` so the mark
 * list, which the GPU backend is keyed on, never depends on a slot only a
 * label reads.
 */
export interface TextMarkEntry extends MarkEntry {
  /**
   * Whether the config writes the mark's color, or leaves it at the mark
   * default. Left at the default, a label prints in the surface's text color.
   */
  ownColor: boolean
}

/**
 * What mark `mark`'s instances over `pos` compare on, by the `row` key each
 * carries: the value a bar stands at, the highest where two in one row cover
 * it; a span's painted color or the number it ramps, the last span drawn
 * there, as the picture and the cluster matrix take it; or 1 where a span
 * covers it at all. A region still holding an earlier color declaration
 * (`heldColor`) answers no color.
 */
export function rowValuesAt(
  region: MarkRegionData,
  mark: number,
  pos: number,
  by: RowCompareBy = 'y',
): Map<number, number> {
  const values = new Map<number, number>()
  const layer = region.layers[mark]
  const lane =
    by === 'y'
      ? layer?.y
      : by === 'colorValue'
        ? layer?.colorValue
        : by === 'colorKey' && layer?.color instanceof Uint32Array
          ? layer.color
          : undefined
  const row = layer?.row
  const stale = by !== 'y' && by !== 'presence' && layer?.heldColor
  if (layer && row && !stale && (lane || by === 'presence')) {
    for (let i = 0; i < layer.count; i++) {
      const v = lane ? lane[i]! : 1
      if (layer.x[i]! <= pos && pos < layer.x2[i]! && !Number.isNaN(v)) {
        const had = values.get(row[i]!)
        if (had === undefined || by !== 'y' || v > had) {
          values.set(row[i]!, v)
        }
      }
    }
  }
  return values
}

/** The highest `row` any visible layer carries, 0 where none packs. */
export function highestRow(
  layers: readonly StoredLayer[],
  visible: readonly boolean[],
) {
  let highest = 0
  for (const [mark, { row }] of layers.entries()) {
    if (row && visible[mark]) {
      for (let i = 0; i < row.length; i++) {
        if (row[i]! > highest) {
          highest = row[i]!
        }
      }
    }
  }
  return highest
}

/**
 * The px each row band gets when the rows fit the plot: the plot split by the
 * row count, in whole px while every row has one, and a fraction of one past
 * that, so the rows squash to fit the plot rather than run off its foot.
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

// The ramp's table, for the pass's sampler; a threshold binds none.
function rampLut(scale: MarkColorScale | undefined) {
  return scale && !isThreshold(scale) ? scale.lut : undefined
}

/**
 * The ramp or threshold one region's layer `i` paints through
 * (`layerColorScale`), read by both backends' lenses and the text layer, so
 * each region draws what it holds.
 */
export function regionColorScale(
  s: MarkRenderState,
  d: MarkRegionData,
  i: number,
): MarkColorScale | undefined {
  return layerColorScale(d.layers[i], s.colorScales[i])
}

/** Mark `i`'s link channels in one region, as its pass and the text layer read them. */
export function linkChannelsOf(d: MarkRegionData, i: number) {
  return withLanes(d.layers[i], MARK_VALUE_LANES.link)
}

// What every shape standing at a value reads besides its own members: the one
// y scale, its region's color scale and its row band.
function valuedParams(s: MarkRenderState, d: MarkRegionData, i: number) {
  return {
    domain: s.domainY,
    scaleType: s.scaleTypeY,
    symlogConstant: s.symlogConstantY,
    colorScale: regionColorScale(s, d, i),
    rowHeight: s.rowHeight,
    rowOffsetPx: -s.scrollTop,
    rowTable: s.rowTable,
  }
}

/** What mark `i`'s link draws under, as its pass and the text layer read it. */
export function linkParamsOf(
  entry: MarkEntry,
  i: number,
  s: MarkRenderState,
  d: MarkRegionData,
): LinkParams {
  return {
    ...valuedParams(s, d, i),
    regions: s.linkRegions,
    linkShape: entry.linkShape,
    valued: entry.valued,
    sizePx: s.markSizes[i]!,
    sizeScale: s.sizeScales[i],
    insetPx: s.valueInsetPx,
  }
}

function withMarkIndex(
  mark: Mark<MarkRegionData, MarkRenderState>,
  markIndex: number,
  type: MarkType,
): DisplayMark {
  return Object.assign(mark, { markIndex, hitBy: MARK_SPECS[type].hit })
}

/**
 * One mark per `marks` entry with a shape, reading `layers[i]` inside its
 * zoom range. A text mark is the text layer's and takes no place here.
 */
export function buildMarkList(entries: readonly MarkEntry[]): DisplayMark[] {
  return entries.flatMap((entry, i) => {
    const mark = shapeMark(entry, i)
    return mark ? [withMarkIndex(mark, i, entry.type)] : []
  })
}

// Entry `i`'s shape over layer `i`, sampling the ramp its region paints
// through, off outside the entry's zoom range.
function layerMark<C, P>(
  entry: MarkEntry,
  i: number,
  shape: MarkShape<C, P>,
  id: string,
  channels: (d: MarkRegionData) => C | undefined,
  params: (s: MarkRenderState, d: MarkRegionData) => P,
) {
  return defineMark({
    shape: withPassId(shape, id),
    channels,
    params,
    textures: (s: MarkRenderState, d: MarkRegionData) => ({
      colorRamp: rampLut(regionColorScale(s, d, i)),
    }),
    enabled: (s: MarkRenderState) => markDrawsAt(entry, s.bpPerPx),
  })
}

function shapeMark(entry: MarkEntry, i: number) {
  const { type } = entry
  const id = `${type}#${i}`
  switch (type) {
    case 'text': {
      return undefined
    }
    case 'bar': {
      return layerMark(
        entry,
        i,
        barMark,
        id,
        d => withLanes(d.layers[i], MARK_VALUE_LANES.bar),
        (s, d) => ({
          ...valuedParams(s, d, i),
          origin: s.origin,
          minWidthPx: s.minWidthPx,
          seamPx: CANVAS_SEAM_PX,
        }),
      )
    }
    case 'point': {
      return layerMark(
        entry,
        i,
        pointMark,
        id,
        d => withLanes(d.layers[i], MARK_VALUE_LANES.point),
        (s, d) => ({
          ...valuedParams(s, d, i),
          diameterPx: s.markSizes[i]!,
          insetPx: s.valueInsetPx,
        }),
      )
    }
    case 'rule': {
      return layerMark(
        entry,
        i,
        ruleMark,
        id,
        d => withLanes(d.layers[i], MARK_VALUE_LANES.rule),
        (s, d) => ({
          ...valuedParams(s, d, i),
          sizePx: s.markSizes[i]!,
          minWidthPx: s.minWidthPx,
          insetPx: s.valueInsetPx,
        }),
      )
    }
    case 'line': {
      const interpolate = entry.interpolate ?? DEFAULT_LINE_INTERPOLATE
      return layerMark(
        entry,
        i,
        lineMarkOf(interpolate),
        `${type}-${interpolate}#${i}`,
        d => withLanes(d.layers[i], MARK_VALUE_LANES.line),
        (s, d) => ({
          ...valuedParams(s, d, i),
          colorFromY: s.colorsFromY[i]!,
          origin: s.origin,
          lineWidth: s.markSizes[i]!,
        }),
      )
    }
    case 'rect': {
      return layerMark(
        entry,
        i,
        spanMark,
        id,
        d => withLanes(d.layers[i], MARK_VALUE_LANES.rect),
        (s, d) => ({
          colorScale: regionColorScale(s, d, i),
          rowHeight: s.rowHeight,
          rowProportion: s.rowProportions[i]!,
          minWidthPx: s.minWidthPx,
          seamPx: 0,
          scrollTop: s.scrollTop,
          rowTable: s.rowTable,
        }),
      )
    }
    case 'link': {
      return layerMark(
        entry,
        i,
        linkMark,
        id,
        d => linkChannelsOf(d, i),
        (s, d) => linkParamsOf(entry, i, s, d),
      )
    }
  }
}
