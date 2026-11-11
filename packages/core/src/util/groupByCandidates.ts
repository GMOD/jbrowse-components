import { censusFields } from './fieldCensus.ts'
import { MAX_GROUPS, compareGroupKeys } from './groupKeys.ts'

import type { Feature } from './simpleFeature.ts'

export interface GroupByCandidate {
  field: string
  // In section order, less the '' catch-all; empty once the field overflowed.
  values: string[]
  // Some feature in view carries no value, which is a section of its own.
  missing: boolean
  // Grouping by this field would fill more than MAX_GROUPS sections.
  overflow: boolean
}

/**
 * The attributes the features carry, each with the distinct values a facet on
 * it would section by, read off the field census (`censusFields`), whose count
 * of a field stops once it passes the cap. The dialog scans once per open, so
 * a thousand genes is ~20ms.
 */
export function summarizeGroupByCandidates(
  features: Iterable<Feature>,
): GroupByCandidate[] {
  const { n, fields } = censusFields(features, MAX_GROUPS)
  return (
    fields
      // the dialog offers strand as its own choice
      .filter(({ field }) => field !== 'strand')
      .sort((a, b) => compareGroupKeys(a.field, b.field))
      .map(({ field, carried, values }) => {
        const missing = carried < n
        const listed =
          values && values.length + (missing ? 1 : 0) <= MAX_GROUPS
            ? values
            : undefined
        return {
          field,
          values: listed ? [...listed].sort(compareGroupKeys) : [],
          missing,
          overflow: listed === undefined,
        }
      })
  )
}
