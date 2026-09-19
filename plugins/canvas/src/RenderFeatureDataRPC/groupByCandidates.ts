import {
  MAX_GROUPS,
  compareGroupKeys,
  valueText,
} from '@jbrowse/core/util/groupKeys'

import type { Feature } from '@jbrowse/core/util'

export interface GroupByCandidate {
  field: string
  // In section order, less the '' catch-all; empty once the field overflowed.
  values: string[]
  // Some feature in view carries no value, which is a section of its own.
  missing: boolean
  // Grouping by this field would fill more than MAX_GROUPS sections.
  overflow: boolean
}

// Structural fields, and strand, which the dialog offers as its own choice.
const NOT_A_GROUPING = new Set([
  'start',
  'end',
  'refName',
  'uniqueId',
  'subfeatures',
  'parentId',
  'strand',
])

/**
 * The attribute names the features carry, each with the distinct values a
 * facet on it would section by. Counting a field stops once it passes the
 * cap, so a near-unique field (name, ID) costs one set per feature only until
 * it overflows.
 */
export function summarizeGroupByCandidates(
  features: Iterable<Feature>,
): GroupByCandidate[] {
  const valuesOf = new Map<string, Set<string>>()
  const carrying = new Map<string, number>()
  const overflowed = new Set<string>()
  let n = 0
  for (const feature of features) {
    n++
    for (const field of Object.keys(feature.toJSON())) {
      if (NOT_A_GROUPING.has(field) || overflowed.has(field)) {
        continue
      }
      const value = valueText(feature.get(field))
      if (value === '') {
        continue
      }
      carrying.set(field, (carrying.get(field) ?? 0) + 1)
      let values = valuesOf.get(field)
      if (!values) {
        values = new Set()
        valuesOf.set(field, values)
      }
      values.add(value)
      if (values.size > MAX_GROUPS) {
        overflowed.add(field)
        valuesOf.delete(field)
      }
    }
  }
  const fields = [...new Set([...valuesOf.keys(), ...overflowed])].sort()
  return fields.map(field => {
    const values = [...(valuesOf.get(field) ?? [])].sort(compareGroupKeys)
    const missing = (carrying.get(field) ?? 0) < n
    const overflow =
      overflowed.has(field) || values.length + (missing ? 1 : 0) > MAX_GROUPS
    return { field, values: overflow ? [] : values, missing, overflow }
  })
}
