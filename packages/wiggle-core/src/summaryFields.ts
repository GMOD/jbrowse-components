export const DEFAULT_SCORE_FIELD = 'score'

/**
 * The three values a zoom bin stores, as the fields a feature serves them
 * under: the mean, and the bin's extremes. A raw record is its own bin, so
 * its score answers all three.
 */
export const SUMMARY_FIELDS = ['score', 'minScore', 'maxScore'] as const
export type SummaryField = (typeof SUMMARY_FIELDS)[number]

export function isSummaryField(field: string): field is SummaryField {
  return (SUMMARY_FIELDS as readonly string[]).includes(field)
}

/** Which stored summary a plotted `y` reads: itself, or `score` for any other field. */
export function summaryFieldOf(y: string): SummaryField {
  return isSummaryField(y) ? y : DEFAULT_SCORE_FIELD
}
