import { ColumnTable, readerOf } from '@jbrowse/core/util/featureTable'

import type { RawFeatureArrays } from '../util.ts'
import type { ArrayFeatureView } from '@gmod/bbi'
import type { Column, NumberLane } from '@jbrowse/core/util/featureTable'

interface SummarizedRows extends RawFeatureArrays {
  minScores: Float32Array
  maxScores: Float32Array
}

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
