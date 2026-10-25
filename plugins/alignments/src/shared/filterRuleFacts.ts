/**
 * What the alignments filter's field rules (`filterFields.ts`) read from
 * outside this directory, each from a module that imports nothing, so
 * `scripts/generateMarkRules.ts` can copy them into `jbrowse validate`.
 */
export { samFlagNames } from '@jbrowse/cigar-utils/samFlags'
export { testsSomething } from '@jbrowse/core/util/fieldPredicateType'
export type { FieldPredicate } from '@jbrowse/core/util/fieldPredicateType'
export {
  JUNCTION_CLASSES,
  JUNCTION_SOURCES,
} from '../features/sashimi/junctionVocabulary.ts'
