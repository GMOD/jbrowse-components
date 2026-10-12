import { wiggleRowsTable } from '../BigWigAdapter/bigWigFeatureTable.ts'

import type { RawFeatureArrays } from '../util.ts'
import type { CodeLane } from '@jbrowse/core/util/featureTable'

function codeLane(labels: number, length: number): CodeLane {
  return labels <= 0x100
    ? new Uint8Array(length)
    : labels <= 0x10000
      ? new Uint16Array(length)
      : new Uint32Array(length)
}

/**
 * Each member's rows one after another, in the order given, its name a
 * `source` category. A member read below its file's first zoom level holds no
 * min or max, so where another member does, its rows hold `NaN` there.
 */
export function multiWiggleFeatureTable(
  members: readonly { source: string; raw: RawFeatureArrays }[],
  refName: string,
) {
  let count = 0
  for (const { raw } of members) {
    count += raw.count
  }
  const summarized = members.map(
    ({ raw }) => raw.minScores !== undefined && raw.maxScores !== undefined,
  )
  const anySummary = summarized.includes(true)
  const starts = new Uint32Array(count)
  const ends = new Uint32Array(count)
  const scores = new Float32Array(count)
  const minScores = anySummary ? new Float32Array(count) : undefined
  const maxScores = anySummary ? new Float32Array(count) : undefined
  const codes = codeLane(members.length, count)
  let offset = 0
  for (const [code, { raw }] of members.entries()) {
    const n = raw.count
    starts.set(raw.starts.subarray(0, n), offset)
    ends.set(raw.ends.subarray(0, n), offset)
    scores.set(raw.scores.subarray(0, n), offset)
    if (minScores && maxScores) {
      if (raw.minScores && raw.maxScores) {
        minScores.set(raw.minScores.subarray(0, n), offset)
        maxScores.set(raw.maxScores.subarray(0, n), offset)
      } else {
        minScores.fill(Number.NaN, offset, offset + n)
        maxScores.fill(Number.NaN, offset, offset + n)
      }
    }
    codes.fill(code, offset, offset + n)
    offset += n
  }
  return wiggleRowsTable(
    { starts, ends, scores, minScores, maxScores, count },
    refName,
    {
      kind: 'category',
      codes,
      labels: members.map(m => m.source),
      at: undefined,
    },
    { kind: 'value', read: i => summarized[codes[i]!] },
  )
}
