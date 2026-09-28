import { ColumnTable } from '@jbrowse/core/util/featureTable'

import type { ArrayFeatureView } from '@gmod/bbi'
import type { Column, NumberLane } from '@jbrowse/core/util/featureTable'

function lane(values: NumberLane): Column {
  return { kind: 'number', values, at: undefined }
}

/**
 * A region's rows as a table over bbi's own arrays, whose ids and hover JSON
 * are `BigWigFeature`'s. The lanes are `subarray`s of the buffer bbi read, so
 * they are read and never transferred.
 */
export function bigWigFeatureTable(view: ArrayFeatureView) {
  const { minScores, maxScores, isSummary, refName, source } = view
  const columns = new Map<string, Column>([
    ['start', lane(view.starts)],
    ['end', lane(view.ends)],
    ['score', lane(view.scores)],
    ['refName', { kind: 'value', read: () => refName }],
    ['source', { kind: 'value', read: () => source }],
    ['summary', { kind: 'value', read: () => isSummary }],
  ])
  if (minScores && maxScores) {
    columns.set('minScore', lane(minScores))
    columns.set('maxScore', lane(maxScores))
  }
  return new ColumnTable(view.length, columns, i => view.id(i))
}
