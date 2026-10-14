import { featureSpanContainsBp } from '../shared/featureSpanBp.ts'

import type { MatrixFeature } from './buildMultiRowMatrix.ts'

/**
 * Each row's value at one base: the last feature covering it wins, as it does
 * in the paint and in the clustering matrix's categorical bins. A row with no
 * feature there is absent, which the sort ranks below every value.
 */
export function rowValuesAt(features: readonly MatrixFeature[], pos: number) {
  const byRow = new Map<string, string>()
  for (const f of features) {
    if (featureSpanContainsBp(f.start, f.end, pos)) {
      byRow.set(f.row, f.value)
    }
  }
  return byRow
}
