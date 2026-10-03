import type { MarkSnapshot } from './markProblems.ts'
import type { PlotFields } from './scanPlotFields.ts'

export const DEFAULT_PLOT_FIELD = 'score'
const IDENTITY_FIELD = 'identity'

// SAM flags 0x4 unmapped, 0x200 QC fail and 0x400 duplicate: the alignments
// display's default `flagExclude`.
export const KEEP_MAPPED_PASSING_UNIQUE_READS =
  'jexl:(feature.flags & 1540) == 0'

/**
 * What a display picked from the Display types menu draws with nothing
 * declared: aligned reads draw their depth over the reads the alignments
 * display counts, since a read's score is its
 * mapping quality, a bar per read stacks thousands on one spot and a link
 * per pair is the arc band's picture rather than a plot's; a link to the
 * other end where the features name one, since a BEDPE, a STAR-Fusion file
 * and an SV VCF are each a pair of loci before they are anything else and a
 * bar of a paired record's score says nothing about what it pairs. Alignments
 * to other genomes draw each alignment at its identity, a row per genome, as
 * PipMaker's percent identity plot did, on an axis spanning the identities
 * alone; their mate is on another assembly, so a link to it would land on the
 * wrong genome. Otherwise
 * bars of `score` where most features carry a numeric one, and nothing where
 * they do not — there is no second column every format agrees on, and
 * guessing one would draw a picture the user did not ask for, as a score on
 * one feature in a hundred would.
 */
export function defaultPlot(
  fields: PlotFields,
): { marks: MarkSnapshot[]; zero?: false } | undefined {
  if (fields.reads) {
    return {
      marks: [
        {
          mark: 'bar',
          transform: [
            { type: 'filter', expr: KEEP_MAPPED_PASSING_UNIQUE_READS },
            { type: 'coverage' },
          ],
        },
      ],
    }
  }
  if (fields.genomes) {
    return fields.numeric.includes(IDENTITY_FIELD)
      ? {
          marks: [{ mark: 'rule', encoding: { y: IDENTITY_FIELD, size: 2 } }],
          zero: false,
        }
      : { marks: [{ mark: 'span' }] }
  }
  if (fields.mated) {
    return { marks: [{ mark: 'link', transform: [{ type: 'mate' }] }] }
  }
  return fields.numeric.includes(DEFAULT_PLOT_FIELD) &&
    !fields.sparse?.includes(DEFAULT_PLOT_FIELD)
    ? { marks: [{ mark: 'bar', encoding: { y: DEFAULT_PLOT_FIELD } }] }
    : undefined
}
