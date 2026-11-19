import { ColumnTable, readerOf } from '@jbrowse/core/util/featureTable'

import type { RawFeatureArrays, RawSummary } from '../util.ts'
import type { Column, NumberLane } from '@jbrowse/core/util/featureTable'

interface SummarizedRows
  extends Omit<RawFeatureArrays, 'summary'>, RawSummary {}

function lane(values: NumberLane): Column {
  return { kind: 'number', values, at: undefined, nanIsAbsent: false }
}

/**
 * Scored rows as a table whose ids and hover JSON are `BigWigFeature`'s. A raw
 * record's min and max lanes hold its score, as a `BigWigFeature`'s do.
 */
export function wiggleRowsTable(
  rows: SummarizedRows,
  refName: string,
  source: Column,
  summary: Column,
) {
  const { starts, ends, scores, minScores, maxScores } = rows
  const sourceOf = readerOf(source)
  const columns = new Map<string, Column>([
    ['start', lane(starts)],
    ['end', lane(ends)],
    ['score', lane(scores)],
    ['refName', { kind: 'value', read: () => refName }],
    ['source', source],
    ['summary', summary],
    ['minScore', lane(minScores)],
    ['maxScore', lane(maxScores)],
  ])
  return new ColumnTable(
    rows.count,
    columns,
    i => `${sourceOf(i)}:${refName}:${starts[i]}-${ends[i]}`,
  )
}

/**
 * A region's rows over the adapter's arrays: bbi's buffer for raw and file-tier
 * rows, `binRawRegion`'s for a synthetic tier. The lanes are read and never
 * transferred.
 */
export function bigWigFeatureTable(
  rows: RawFeatureArrays,
  source: string,
  refName: string,
) {
  const { starts, ends, scores, summary, count } = rows
  return wiggleRowsTable(
    {
      starts,
      ends,
      scores,
      minScores: summary?.minScores ?? scores,
      maxScores: summary?.maxScores ?? scores,
      count,
    },
    refName,
    { kind: 'value', read: () => source },
    { kind: 'value', read: () => summary !== undefined },
  )
}
