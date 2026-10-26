/**
 * What the bases filter's field rules (`basesFilterRules.ts`) read from
 * outside this directory, each from a module that imports nothing, so
 * `scripts/generateMarkRules.ts` can copy them into `jbrowse validate`.
 */
export { layerEntryProblems } from '@jbrowse/alignments-core/layerFilterRules'
export type { FieldPredicate } from '@jbrowse/core/util/fieldPredicateType'
