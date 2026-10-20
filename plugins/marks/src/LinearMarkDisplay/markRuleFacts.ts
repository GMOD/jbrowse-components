/**
 * What the rule list reads from outside this plugin, each from the module that
 * states it. `scripts/generateMarkRules.ts` copies those modules into
 * `jbrowse validate` and writes this file's counterpart over the copies, so a
 * module named here imports nothing.
 */
export {
  AGGREGATE_OPS,
  BIN_OVERLAP_FIELD,
  DEFAULT_AGGREGATE_OP,
  DEFAULT_BIN_AS,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FORMULA_AS,
  DEFAULT_PILEUP_AS,
  aggregateFieldName,
  isFieldPair,
  stepsOutput,
} from '@jbrowse/core/util/stepOutputs'
export type {
  AggregateOpName,
  StepOutline,
} from '@jbrowse/core/util/stepOutputs'
export { isNamedColor } from '@jbrowse/core/util/color/cssColorsLevel4'
export { isJexl } from '@jbrowse/core/util/jexlStrings'
export {
  FEATURE_FIELD_PRESETS,
  colorProblems,
  fieldScaleOf,
  paintedScale,
  scaleEndProblems,
  universalPresetOf,
} from '@jbrowse/core/util/colorScale'
export type { ColorSlots, ScaleEnds } from '@jbrowse/core/util/colorScale'
export { SHAPE_NAMES } from '@jbrowse/core/util/shapeNameList'
