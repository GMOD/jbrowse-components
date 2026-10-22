/** The shapes a `point` mark draws, by the names an encoding writes. */
export const SHAPE_NAMES = [
  'circle',
  'triangle-down',
  'diamond',
  'square',
] as const

export type ShapeName = (typeof SHAPE_NAMES)[number]

/**
 * What a shape scale with no `range` hands out, in order. `square` is drawn
 * only where named: a circle 3 px across or less draws as a square, so a small
 * Point size would paint two categories alike.
 */
export const DEFAULT_SHAPE_RANGE: readonly ShapeName[] = [
  'circle',
  'triangle-down',
  'diamond',
]
