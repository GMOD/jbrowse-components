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
  })
}

test('pairs a data file with its index: one addable track, no orphans', () => {
  const { rows, orphanIndexCount, skippedCount } = summarize([
    uri('/a.bam'),
    uri('/a.bam.bai'),
  ])
  expect(rows).toHaveLength(1)
  expect(rows[0]!.status).toBe('ok')
  expect(orphanIndexCount).toBe(0)
  expect(skippedCount).toBe(0)
})

test('an index with no matching data file is counted as an orphan', () => {
  const { rows, orphanIndexCount } = summarize([uri('/orphan.tbi')])
  expect(rows).toHaveLength(0)
  expect(orphanIndexCount).toBe(1)
})

// the count used to be (index files pasted) - (index files paired), so any data
// file offered a second sidecar reported one as having "no matching data file"
test('a second sidecar for one data file is not counted as an orphan', () => {
  const { rows, orphanIndexCount } = summarize([
    uri('/a.bam'),
    uri('/a.bam.bai'),
    uri('/a.bam.csi'),
  ])
  expect(rows).toHaveLength(1)
  expect(orphanIndexCount).toBe(0)
})

test('an index whose kind fits no data file present is still an orphan', () => {
  const { orphanIndexCount } = summarize([uri('/s.bam'), uri('/s.tbi')])
  expect(orphanIndexCount).toBe(1)
})

test('an unrecognized extension is a skipped row, not addable', () => {
  const { rows, skippedCount } = summarize([uri('/mystery.qqq')])
  expect(rows).toHaveLength(1)
  expect(rows[0]!.status).toBe('unknown')
  expect(skippedCount).toBe(1)
})

test('surfaces url loadability warnings', () => {
  const { warnings } = summarize([uri('ftp://x.com/a.bam')])
  expect(warnings.some(w => w.includes('ftp'))).toBe(true)
})
