import { SimpleFeature } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

// Build a single-score bedGraph feature for value column j, or undefined when
// the value is not numeric. A wide file names each value column's source in
// its header; a tidy one has a `source` column naming each row's instead.
// Shared by BedGraphAdapter and BedGraphTabixAdapter.
export function makeBedGraphFeature({
  uniqueId,
  refName,
  start,
  end,
  names,
  j,
  value,
  rowSource,
}: {
  uniqueId: string
  refName: string
  start: number
  end: number
  names: string[]
  j: number
  value: string
  rowSource?: string
}): Feature | undefined {
  const score = +value
  return Number.isNaN(score)
    ? undefined
    : new SimpleFeature({
        id: uniqueId,
        data: {
          refName,
          start,
          end,
          score,
          source: rowSource ?? (names[j] || `col${j}`),
        },
      })
}
