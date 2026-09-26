import type { MarkSnapshot } from './markProblems.ts'
import type { PlotFields } from './scanPlotFields.ts'

export const DEFAULT_PLOT_FIELD = 'score'

/**
 * What a display picked from the Display types menu draws with nothing
 * declared: a link to the other end where the features name one, since a
 * BEDPE, a STAR-Fusion file and an SV VCF are each a pair of loci before they
 * are anything else and a bar of a paired record's score says nothing about
 * what it pairs. Aligned reads draw their depth, since a read's score is its
 * mapping quality and a bar per read stacks thousands on one spot. Otherwise
 * bars of `score` where most features carry a numeric one, and nothing where
 * they do not — there is no second column every format agrees on, and
 * guessing one would draw a picture the user did not ask for, as a score on
 * one feature in a hundred would.
 */
export function defaultPlotMarks(
  fields: PlotFields,
): MarkSnapshot[] | undefined {
  if (fields.mated) {
    return [{ mark: 'link', transform: [{ type: 'mate' }] }]
  }
  if (fields.reads) {
    return [{ mark: 'bar', transform: [{ type: 'coverage' }] }]
  }
  return fields.numeric.includes(DEFAULT_PLOT_FIELD) &&
    !fields.sparse?.includes(DEFAULT_PLOT_FIELD)
    ? [{ mark: 'bar', encoding: { y: DEFAULT_PLOT_FIELD } }]
    : undefined
}
