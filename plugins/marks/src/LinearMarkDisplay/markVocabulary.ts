/**
 * The names a `marks` list is written in and the ones a slot left off reads
 * as, in a module that imports nothing: the config schema declares its
 * enumerations and defaults from here, the rule list reads the same constants,
 * and `jbrowse validate` carries a copy of both.
 */

export const MARK_SHAPES = ['bar', 'point', 'span'] as const
export type MarkShapeName = (typeof MARK_SHAPES)[number]
export const DEFAULT_MARK_SHAPE: MarkShapeName = 'bar'

export const MARK_SOURCES = ['features', 'density'] as const
export type MarkSourceName = (typeof MARK_SOURCES)[number]
export const DEFAULT_MARK_SOURCE: MarkSourceName = 'features'

export const TRANSFORM_TYPES = [
  'filter',
  'formula',
  'bin',
  'aggregate',
  'coverage',
  'flatten',
  'pileup',
] as const
export type TransformTypeName = (typeof TRANSFORM_TYPES)[number]
export const DEFAULT_TRANSFORM_TYPE: TransformTypeName = 'filter'

export const AGGREGATE_OPS = ['count', 'sum', 'mean', 'min', 'max'] as const
export type AggregateOpName = (typeof AGGREGATE_OPS)[number]
export const DEFAULT_AGGREGATE_OP: AggregateOpName = 'count'
