import type { MarkShapeName } from './configSchema.ts'
import type { LaneName } from '@jbrowse/core/util/markEncoding'

/**
 * The lanes the worker fills for each shape. The encoder fills whichever of
 * `color` and `colorValue` the colour declaration calls for.
 *
 * Its own module, with type-only imports: the config schema reads it, and
 * markList.ts beside it takes render-core's marks barrel — shader sources
 * included — which the examples sites' eager budget then pays for.
 */
export const SHAPE_LANES = {
  bar: ['y', 'row', 'color', 'colorValue', 'index'],
  point: ['y', 'row', 'color', 'colorValue', 'glyph', 'index'],
  span: ['row', 'color', 'index'],
} as const satisfies Record<MarkShapeName, readonly LaneName[]>
