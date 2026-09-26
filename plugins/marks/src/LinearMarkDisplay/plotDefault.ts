import type { MarkSnapshot } from './markProblems.ts'
import type { PlotFields } from './scanPlotFields.ts'

export const DEFAULT_PLOT_FIELD = 'score'

/** The link a record naming a second locus draws, over the step that finds it. */
export function linkMarks(): MarkSnapshot[] {
  return [
    {
      mark: 'link',
      encoding: { x2: { chrom: 'mate.refName', pos: 'mate.start' } },
      transform: [{ type: 'mate' }],
    },
  ]
}

/**
 * What a display picked from the Display types menu draws with nothing
 * declared: a link to the other end where the features name one, since a
 * BEDPE, a STAR-Fusion file and an SV VCF are each a pair of loci before they
 * are anything else and a bar of a paired record's score says nothing about
 * what it pairs. Otherwise bars of `score` where most features carry a numeric
 * one, and nothing where they do not — there is no second column every format
 * agrees on, and guessing one would draw a picture the user did not ask for,
 * as a score on one feature in a hundred would.
 */
export function defaultPlotMarks(
  fields: PlotFields,
): MarkSnapshot[] | undefined {
  if (fields.mated) {
    return linkMarks()
  }
  return fields.numeric.includes(DEFAULT_PLOT_FIELD) &&
    !fields.sparse?.includes(DEFAULT_PLOT_FIELD)
    ? [{ mark: 'bar', encoding: { y: DEFAULT_PLOT_FIELD } }]
    : undefined
}
