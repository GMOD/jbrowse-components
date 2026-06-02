import { SimpleFeature } from '@jbrowse/core/util'

import { buildReadVsRefFeatures } from './buildReadVsRefFeatures.ts'

function makeFeature(
  data: Record<string, unknown> & {
    start: number
    end: number
    refName: string
  },
) {
  return new SimpleFeature({ uniqueId: 'test-feat', ...data })
}

test('primary alignment with no SA tag yields a single feature', () => {
  const { features, totalLength, readName, seq } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 1100,
      strand: 1,
      CIGAR: '10S100M',
      flags: 0,
      name: 'read1',
      seq: 'ACGT',
      tags: {},
    }),
  )
  expect(features).toHaveLength(1)
  expect(readName).toBe('read1')
  expect(seq).toBe('ACGT')
  // 10S100M: 100 aligned + 10 soft clip = 110 total read length
  expect(totalLength).toBe(110)
  expect(features[0]!.clipLengthAtStartOfRead).toBe(10)
  expect(features[0]!.strand).toBe(1)
  expect(features[0]!.mate).toMatchObject({
    refName: 'read1',
    start: 10,
    end: 110,
  })
})

test('SA features are sorted by clip length, primary included in order', () => {
  // Primary is 50S50M (clip 50 at read start), supplementary SA is 50M50S
  // (clip 0). The supplementary must sort before the primary along the read.
  const { features } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chr1',
      start: 2000,
      end: 2050,
      strand: 1,
      CIGAR: '50S50M',
      flags: 0,
      name: 'read42',
      seq: 'N',
      tags: { SA: 'chr2,3001,+,50M50S,60,0;' },
    }),
  )
  expect(features).toHaveLength(2)
  expect(features.map(f => f.clipLengthAtStartOfRead)).toEqual([0, 50])
  // the entry with clip 0 is the supplementary on chr2, the clip 50 is primary
  expect(features[0]!.refName).toBe('chr2')
  expect(features[1]!.refName).toBe('chr1')
})

test('supplementary alignment derives total length from SA[0] CIGAR', () => {
  // flags bit 2048 = supplementary; this slice is 50M but the primary in SA is
  // 50S50M (= 100bp read), so totalLength must come from the SA entry.
  const { totalLength } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chr2',
      start: 3000,
      end: 3050,
      strand: 1,
      CIGAR: '50M',
      flags: 2048,
      name: 'read42',
      seq: '',
      tags: { SA: 'chr1,2001,+,50S50M,60,0;' },
    }),
  )
  expect(totalLength).toBe(100)
})
