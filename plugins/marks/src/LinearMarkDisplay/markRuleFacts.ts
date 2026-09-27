/**
 * What the rule list reads from outside this plugin, each from the module that
 * states it. `scripts/generateMarkRules.ts` copies those modules into
 * `jbrowse validate` and writes this file's counterpart over the copies, so a
 * module named here imports nothing.
 */
export { aggregateFieldName } from '@jbrowse/core/util/aggregateFieldName'
export { isJexl } from '@jbrowse/core/util/jexlStrings'
export {
  FEATURE_FIELD_PRESETS,
  colorProblems,
  fieldScaleOf,
  paintedScale,
  scaleEndProblems,
} from '@jbrowse/core/util/colorScale'
export type { ColorSlots, ScaleEnds } from '@jbrowse/core/util/colorScale'
