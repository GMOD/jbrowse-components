import type { MarkShapeName } from './markVocabulary.ts'

/** An encoding channel a shape reads, besides `x` and `x2`. */
export type ShapeChannel = 'y' | 'row' | 'color' | 'glyph'

/** A lane the worker fills: a channel, a ramp's raw values, or the hit index. */
export type ShapeLane = ShapeChannel | 'colorValue' | 'index'

export interface ShapeSpec {
  /** The encoding channels the shape reads besides `x` and `x2`. */
  readonly channels: readonly ShapeChannel[]
  /**
   * Where a ramp colour resolves: `display` from the raw values each region
   * sends, over the domain unioned across regions; `worker` into packed
   * colours, per region.
   */
  readonly ramp: 'display' | 'worker'
}

/**
 * What each shape reads: the one statement the lane request, the rule list and
 * the model's value tests derive theirs from.
 *
 * Its own module, reaching only the vocabulary beside it: the rule list reads
 * it and `jbrowse validate` carries a copy, and markList.ts takes render-core's
 * marks barrel — shader sources included — which the examples sites' eager
 * budget then pays for. `layerRequests` in model.ts is where each lane is
 * checked to be one the encoder fills.
 */
export const SHAPE_SPECS = {
  bar: { channels: ['y', 'row', 'color'], ramp: 'display' },
  point: { channels: ['y', 'row', 'color', 'glyph'], ramp: 'display' },
  span: { channels: ['row', 'color'], ramp: 'worker' },
} as const satisfies Record<MarkShapeName, ShapeSpec>

function specOf(shape: MarkShapeName): ShapeSpec {
  return SHAPE_SPECS[shape]
}

/** Whether a shape stands at a `y` value, so a mark of it naming none draws nothing. */
export function readsValue(shape: MarkShapeName) {
  return specOf(shape).channels.includes('y')
}

/** Whether a shape's ramp colour resolves per region, in the worker. */
export function rampResolvesPerRegion(shape: MarkShapeName) {
  return specOf(shape).ramp === 'worker'
}

/**
 * The lanes a mark asks the worker to fill: its shape's channels, a ramp's raw
 * values beside the colour where the display resolves the ramp, and the hit
 * index. The encoder fills whichever of `color` and `colorValue` the colour
 * declaration calls for.
 */
export function markLanes(shape: MarkShapeName): ShapeLane[] {
  const spec = specOf(shape)
  return [
    ...spec.channels.flatMap((channel): ShapeLane[] =>
      channel === 'color' && spec.ramp === 'display'
        ? [channel, 'colorValue']
        : [channel],
    ),
    'index',
  ]
}
