import { summarizeBulkInput } from './preview.ts'
import { makeModel, uri } from './testUtils.tsx'

import type { FileLocation } from '@jbrowse/core/util/types'

// summarizeBulkInput expects an already-deduped location list (the workflow
// dedupes via useBulkLocations before calling it).
function summarize(locations: FileLocation[]) {
  return summarizeBulkInput({
    locations,
    model: makeModel(),
    assembly: 'volvox',
    timestamp: 123,
  })
}

test('pairs a data file with its index: one addable track, no orphans', () => {
  const { rows, okRows, orphanIndexCount, skippedCount } = summarize([
    uri('/a.bam'),
    uri('/a.bam.bai'),
  ])
  expect(rows).toHaveLength(1)
  expect(okRows).toHaveLength(1)
  expect(orphanIndexCount).toBe(0)
  expect(skippedCount).toBe(0)
})

test('an index with no matching data file is counted as an orphan', () => {
  const { rows, orphanIndexCount } = summarize([uri('/orphan.tbi')])
  expect(rows).toHaveLength(0)
  expect(orphanIndexCount).toBe(1)
})

test('an unrecognized extension is a skipped row, not addable', () => {
  const { rows, okRows, skippedCount } = summarize([uri('/mystery.qqq')])
  expect(rows).toHaveLength(1)
  expect(okRows).toHaveLength(0)
  expect(skippedCount).toBe(1)
})

test('surfaces url loadability warnings', () => {
  const { warnings } = summarize([uri('ftp://x.com/a.bam')])
  expect(warnings.some(w => w.includes('ftp'))).toBe(true)
})
