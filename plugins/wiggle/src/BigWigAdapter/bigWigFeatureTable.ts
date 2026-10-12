import { ColumnTable, readerOf } from '@jbrowse/core/util/featureTable'

import type { RawFeatureArrays } from '../util.ts'
import type { ArrayFeatureView } from '@gmod/bbi'
import type { Column, NumberLane } from '@jbrowse/core/util/featureTable'

function lane(values: NumberLane, nanIsAbsent = false): Column {
  return { kind: 'number', values, at: undefined, nanIsAbsent }
}

/**
 * Scored rows as a table whose ids and hover JSON are `BigWigFeature`'s. A
 * `NaN` min or max is a row with no summary, which `get` answers as
 * `undefined`, as a `BigWigFeature` over raw records does.
 */
export function wiggleRowsTable(
  rows: RawFeatureArrays,
  refName: string,
  source: Column,
  summary: Column,
) {
  const { starts, ends, minScores, maxScores } = rows
  const sourceOf = readerOf(source)
  const columns = new Map<string, Column>([
    ['start', lane(starts)],
    ['end', lane(ends)],
    ['score', lane(rows.scores)],
    ['refName', { kind: 'value', read: () => refName }],
    ['source', source],
    ['summary', summary],
  ])
  if (minScores && maxScores) {
    columns.set('minScore', lane(minScores, true))
    columns.set('maxScore', lane(maxScores, true))
  }
  return new ColumnTable(
    rows.count,
    columns,
    i => `${sourceOf(i)}:${refName}:${starts[i]}-${ends[i]}`,
  )
}

/**
 * A region's rows over bbi's own arrays. The lanes are `subarray`s of the
 * buffer bbi read, so they are read and never transferred.
 */
export function bigWigFeatureTable(view: ArrayFeatureView) {
  const { source, isSummary } = view
  return wiggleRowsTable(
    {
      starts: view.starts,
      ends: view.ends,
      scores: view.scores,
      minScores: view.minScores,
      maxScores: view.maxScores,
      count: view.length,
    },
    view.refName,
    { kind: 'value', read: () => source },
    { kind: 'value', read: () => isSummary },
  )
}
