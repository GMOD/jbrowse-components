/**
 * The names a `marks` list is written in and the ones a slot left off reads
 * as, in a module that imports nothing: the config schema declares its
 * enumerations and defaults from here, the rule list reads the same constants,
 * and `jbrowse validate` carries a copy of both.
 */

export const MARK_TYPES = ['bar', 'point', 'span', 'text'] as const
export type MarkType = (typeof MARK_TYPES)[number]
export const DEFAULT_MARK_TYPE: MarkType = 'bar'

export const MARK_SOURCES = ['features', 'density'] as const
export type MarkSourceName = (typeof MARK_SOURCES)[number]
export const DEFAULT_MARK_SOURCE: MarkSourceName = 'features'

export const DEFAULT_FORMULA_AS = 'value'
export const DEFAULT_BIN_FIELD = 'start'
export const DEFAULT_BIN_AS = ['start', 'end'] as const
export const DEFAULT_COVERAGE_AS = 'coverage'
export const DEFAULT_FLATTEN_FIELD = 'subfeatures'
export const DEFAULT_PILEUP_AS = 'row'
export const DEFAULT_PILEUP_FIELDS = ['start', 'end'] as const
export const DEFAULT_TEXT_FIELD = 'name'

export const AGGREGATE_OPS = ['count', 'sum', 'mean', 'min', 'max'] as const
export type AggregateOpName = (typeof AGGREGATE_OPS)[number]
export const DEFAULT_AGGREGATE_OP: AggregateOpName = 'count'
