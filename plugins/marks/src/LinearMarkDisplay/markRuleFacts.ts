/**
 * What the rule list reads from outside this plugin, each from the module that
 * states it. `scripts/generateMarkRules.ts` copies those modules into
 * `jbrowse validate` and writes this file's counterpart over the copies, so a
 * module named here imports nothing.
 */
export { isJexl } from '@jbrowse/core/util/jexlStrings'
export { paintedScale } from '@jbrowse/display-kit/colorScale'
export type { ColorScaleName } from '@jbrowse/display-kit/colorScale'
