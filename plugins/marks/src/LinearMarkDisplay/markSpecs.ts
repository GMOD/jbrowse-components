import {
  DEFAULT_LINE_WIDTH_PX,
  DEFAULT_LINK_STROKE_PX,
  DEFAULT_POINT_DIAMETER_PX,
} from './markVocabulary.ts'

import type {
  MarkInterpolation,
  MarkMember,
  MarkType,
} from './markVocabulary.ts'

/** An encoding channel a mark reads, besides `x` and `x2`. */
export type MarkChannel =
  | 'y'
  | 'row'
  | 'color'
  | 'shape'
  | 'text'
  | 'size'
  | 'strokeWidth'

/** The channel holding a mark's px: a point's `size`, a stroked mark's `strokeWidth`. */
export type PxChannel = Extract<MarkChannel, 'size' | 'strokeWidth'>

/**
 * A lane the worker fills: a channel, a quantitative color's raw values, an
 * ordinal color's keys, the point painter's code for a `shape`, a link's
 * stroke width in the `size` lane the worker names it by, the sequence a far
 * `x2` lies on, or the hit index.
 */
export type MarkLane =
  | Exclude<MarkChannel, 'shape' | 'strokeWidth'>
  | 'colorValue'
  | 'colorKey'
  | 'glyph'
  | 'x2Ref'
  | 'series'
  | 'index'

export interface MarkSpec {
  /** The encoding channels the mark reads besides `x` and `x2`. */
  readonly channels: readonly MarkChannel[]
  /**
   * What `y` is to the mark: `required` stands at a value and draws nothing
   * without one, `optional` stands at one where named and in the middle of
   * its band otherwise, `none` reads no value.
   */
  readonly value: 'required' | 'optional' | 'none'
  /**
   * How the mark answers a hover: `index` searches a spatial index the worker
   * builds over its instances, `rows` finds them by the row they stand in and
   * their bp, and `false` answers none. Only `index` asks the worker for a
   * lane. A mark standing between `x` and `x2` in one row answers by rows; a
   * point keeps the index, since a scatter crowds a bp window with values the
   * index prunes, and a link spans rows.
   */
  readonly hit: 'index' | 'rows' | false
  /**
   * Whether the mark's `x2` may lie on another sequence, and so asks for the
   * lane naming which.
   */
  readonly farFoot?: boolean
  /**
   * The channel whose number is the mark's px: a point's `size`, its
   * diameter, or a stroked mark's `strokeWidth`. A mark listing it among
   * `channels` reads a field there too, through the `size` lane. Absent, the
   * mark draws no width.
   */
  readonly px?: PxChannel
  /** The px a mark draws at where its `px` channel writes no number. */
  readonly defaultPx?: number
  /**
   * Whether the mark strokes through its instances in order, and so asks for
   * the series each one belongs to.
   */
  readonly path?: boolean
  /** The `mark` members the type reads beside its `type`. */
  readonly members?: readonly MarkMember[]
  /** The `interpolate` values the type draws, its default first. */
  readonly interpolations?: readonly MarkInterpolation[]
}

/**
 * What each mark type reads: the one statement the lane request, the rule list and
 * the model's value tests derive theirs from.
 *
 * Its own module, reaching only the vocabulary beside it: the rule list reads
 * it and `jbrowse validate` carries a copy, and markList.ts takes render-core's
 * marks barrel — shader sources included — which the examples sites' eager
 * budget then pays for. `layerRequests` in model.ts is where each lane is
 * checked to be one the encoder fills.
 */
export const MARK_SPECS = {
  bar: {
    channels: ['y', 'row', 'color'],
    value: 'required',
    hit: 'rows',
  },
  point: {
    channels: ['y', 'row', 'color', 'shape'],
    value: 'required',
    hit: 'index',
    px: 'size',
    defaultPx: DEFAULT_POINT_DIAMETER_PX,
  },
  rule: {
    channels: ['y', 'row', 'color'],
    value: 'required',
    hit: 'rows',
    px: 'strokeWidth',
    defaultPx: DEFAULT_POINT_DIAMETER_PX,
  },
  line: {
    channels: ['y', 'row', 'color'],
    value: 'required',
    hit: 'rows',
    px: 'strokeWidth',
    defaultPx: DEFAULT_LINE_WIDTH_PX,
    path: true,
    members: ['interpolate', 'gapBp'],
    interpolations: ['step', 'linear'],
  },
  rect: {
    channels: ['row', 'color'],
    value: 'none',
    hit: 'rows',
    members: ['height'],
  },
  text: {
    channels: ['y', 'row', 'color', 'text'],
    value: 'optional',
    hit: false,
  },
  link: {
    channels: ['y', 'row', 'color', 'strokeWidth'],
    value: 'optional',
    hit: 'index',
    farFoot: true,
    px: 'strokeWidth',
    defaultPx: DEFAULT_LINK_STROKE_PX,
    members: ['interpolate'],
    interpolations: ['dome', 'arc', 'linear'],
  },
} as const satisfies Record<MarkType, MarkSpec>

function specOf(type: MarkType): MarkSpec {
  return MARK_SPECS[type]
}

/** Whether a mark type stands at a `y` value, so a mark of it naming none draws nothing. */
export function readsValue(type: MarkType) {
  return specOf(type).value === 'required'
}

/** Whether a mark type may plot a `y`, and so folds its values into the axis. */
export function plotsValue(type: MarkType) {
  return specOf(type).value !== 'none'
}

/** The channel holding a mark type's px, `size` or `strokeWidth`, if it draws one. */
export function pxChannelOf(type: MarkType): PxChannel | undefined {
  return specOf(type).px
}

/**
 * A mark's px: the number its `px` channel writes, else its type's default,
 * and 0 for a type that draws no width.
 */
export function markSizePx(type: MarkType, written: number | undefined) {
  return written ?? specOf(type).defaultPx ?? 0
}

/**
 * The `interpolate` a mark type draws for the one its config writes: that one
 * where the type draws it, else the type's default; none for a type that
 * joins nothing.
 */
export function interpolationOf(
  type: MarkType,
  written: MarkInterpolation | undefined,
) {
  const drawn = specOf(type).interpolations
  return written !== undefined && drawn?.includes(written)
    ? written
    : drawn?.[0]
}

/** Whether a mark type answers a hover through the hit index the worker builds. */
function hitsByIndex(type: MarkType) {
  return specOf(type).hit === 'index'
}

/**
 * The lanes a mark asks the worker to fill: its type's channels, the color
 * lanes `colorLanesOf` chose for its declaration, and the hit index where the
 * mark answers a hover through one.
 */
export function markLanes(
  type: MarkType,
  colorLanes: readonly MarkLane[],
): MarkLane[] {
  const spec = specOf(type)
  return [
    ...spec.channels.flatMap((channel): readonly MarkLane[] =>
      channel === 'shape'
        ? ['glyph']
        : channel === 'color'
          ? colorLanes
          : channel === 'strokeWidth'
            ? ['size']
            : [channel],
    ),
    ...(spec.farFoot ? (['x2Ref'] as const) : []),
    ...(spec.path ? (['series'] as const) : []),
    ...(hitsByIndex(type) ? (['index'] as const) : []),
  ]
}
