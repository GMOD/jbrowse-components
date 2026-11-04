import { SimpleFeature } from '@jbrowse/core/util'

import { MAPQ_UNAVAILABLE, getMappingQuality } from './util.ts'

function record(data: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'r',
    refName: 'chr1',
    start: 0,
    end: 100,
    ...data,
  })
}

test("a SAM record's score is its MAPQ", () => {
  expect(getMappingQuality(record({ flags: 0, score: 37 }))).toBe(37)
})

test('a SAM record with no score has no MAPQ', () => {
  expect(getMappingQuality(record({ flags: 0 }))).toBe(MAPQ_UNAVAILABLE)
})

test("a PAF block's mappingQual is its MAPQ", () => {
  expect(getMappingQuality(record({ mappingQual: 60 }))).toBe(60)
})

// an MCScan anchor's score, 1160 here, read as MAPQ clamped to 255 and titled
// the best anchors "MAPQ unavailable"
test("an MCScan or BLAST row's score is no MAPQ", () => {
  expect(getMappingQuality(record({ score: 1160 }))).toBe(MAPQ_UNAVAILABLE)
  expect(getMappingQuality(record({ score: '512' }))).toBe(MAPQ_UNAVAILABLE)
})
