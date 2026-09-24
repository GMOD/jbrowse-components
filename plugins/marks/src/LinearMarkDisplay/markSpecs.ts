import type { MarkType } from './markVocabulary.ts'

/** An encoding channel a mark reads, besides `x` and `x2`. */
export type MarkChannel = 'y' | 'row' | 'color' | 'shape' | 'text'

/**
 * A lane the worker fills: a channel, a ramp's raw values, the point painter's
 * code for a `shape`, or the hit index.
 */
export type MarkLane =
  | Exclude<MarkChannel, 'shape'>
  | 'colorValue'
  | 'glyph'
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
   * Where a ramp colour resolves: `display` from the raw values each region
   * sends, over the domain unioned across regions; `worker` into packed
   * colours, per region.
   */
  readonly ramp: 'display' | 'worker'
  /** Whether the mark answers a hover, and so asks the worker for the hit index. */
  readonly hit: boolean
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
    ramp: 'display',
    hit: true,
  },
  point: {
    channels: ['y', 'row', 'color', 'shape'],
    value: 'required',
    ramp: 'display',
    hit: true,
  },
  span: {
    channels: ['row', 'color'],
    value: 'none',
    ramp: 'worker',
    hit: true,
  },
  text: {
    channels: ['y', 'row', 'color', 'text'],
    value: 'optional',
    ramp: 'worker',
    hit: false,
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

/** Whether a mark type's ramp colour resolves per region, in the worker. */
export function rampResolvesPerRegion(type: MarkType) {
  return specOf(type).ramp === 'worker'
}

/**
 * The lanes a mark asks the worker to fill: its type's channels, a ramp's raw
 * values beside the colour where the display resolves the ramp, and the hit
 * index where the mark answers a hover. The encoder fills whichever of
 * `color` and `colorValue` the colour declaration calls for.
 */
export function markLanes(type: MarkType): MarkLane[] {
  const spec = specOf(type)
  return [
    ...spec.channels.flatMap((channel): MarkLane[] =>
      channel === 'shape'
        ? ['glyph']
        : channel === 'color' && spec.ramp === 'display'
          ? [channel, 'colorValue']
          : [channel],
    ),
    ...(spec.hit ? (['index'] as const) : []),
  ]
}
