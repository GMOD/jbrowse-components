import { buildReadVsRefFeatures } from './buildReadVsRefFeatures.ts'

import type { ReadVsRefInput } from './buildReadVsRefFeatures.ts'

// spelled out rather than Omit<ReadVsRefInput, 'uniqueId'>: the input's index
// signature makes keyof it `string`, so Omit collapses every named property.
function makeFeature(data: {
  refName: string
  start: number
  end: number
  strand?: number
  CIGAR?: string
  flags?: number
  name?: string
  seq?: string
  tags?: Record<string, unknown>
}): ReadVsRefInput {
  return { uniqueId: 'test-feat', ...data }
}

test('primary alignment with no SA tag yields a single feature', () => {
  // a real SEQ spans the whole read: 10 soft-clipped + 100 aligned bases
  const readSeq = 'ACGT'.repeat(28).slice(0, 110)
  const { features, totalLength, readName, seq } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 1100,
      strand: 1,
      CIGAR: '10S100M',
      flags: 0,
      name: 'read1',
      seq: readSeq,
      tags: {},
    }),
  )
  expect(features).toHaveLength(1)
  expect(readName).toBe('read1')
  expect(seq).toBe(readSeq)
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

test('a reverse-strand primary is measured in the same frame as its SA entries', () => {
  // featurizeSA(normalize) places every SA entry in the *query's reference
  // orientation*, so the primary must be measured there too. Reading the clip
  // off the read's own 5'->3' end instead gave this primary clip 0 — tying with
  // the supplementary and sorting the two segments backwards along the read.
  const { features } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chr1',
      start: 2000,
      end: 2070,
      strand: -1,
      CIGAR: '30S70M',
      flags: 0,
      name: 'revRead',
      seq: 'N',
      tags: { SA: 'chr2,3001,-,30M70S,60,0;' },
    }),
  )
  expect(features.map(f => f.clipLengthAtStartOfRead)).toEqual([0, 30])
  expect(features.map(f => f.refName)).toEqual(['chr2', 'chr1'])
  expect(features[1]!.mate).toMatchObject({ start: 30, end: 100 })
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

test('supplementary alignment with no SA tag falls back to its own CIGAR', () => {
  // Nothing points at the primary, so its length is unknowable; the only
  // alternative to the alignment's own CIGAR is reading SA[0] off an empty
  // list, which used to throw a bare TypeError out of the launcher.
  const { totalLength, features } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chr2',
      start: 3000,
      end: 3050,
      strand: 1,
      CIGAR: '20H50M',
      flags: 2048,
      name: 'orphanSupp',
      tags: {},
    }),
  )
  expect(totalLength).toBe(70)
  expect(features).toHaveLength(1)
})

test('a hard-clipped supplementary reports no seq rather than a misplaced one', () => {
  // 20H50M with a 100bp primary in SA: SEQ holds only this alignment's 50
  // bases, which laid over [0,100) of the synthetic read assembly would put
  // the wrong base at every position of the sequence track.
  const { seq, totalLength } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chr2',
      start: 3000,
      end: 3050,
      strand: 1,
      CIGAR: '20H50M',
      flags: 2048,
      name: 'read42',
      seq: 'A'.repeat(50),
      tags: { SA: 'chr1,2001,+,30S70M,60,0;' },
    }),
  )
  expect(totalLength).toBe(100)
  expect(seq).toBeUndefined()
})

test('features and their mates are paired by syntenyId in read order', () => {
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
  expect(features.map(f => f.syntenyId)).toEqual([0, 1])
  expect(features.map(f => f.mate.syntenyId)).toEqual([0, 1])
  expect(features.map(f => f.mate.uniqueId)).toEqual([
    `${features[0]!.uniqueId}_mate`,
    `${features[1]!.uniqueId}_mate`,
  ])
})

test('canonical refName remap applies to the primary and its SA entries', () => {
  const remap: Record<string, string> = { chr1: '1', chr2: '2' }
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
    r => remap[r],
  )
  expect(features.map(f => f.refName)).toEqual(['2', '1'])
})

test('an unaliased refName survives the canonical remap unchanged', () => {
  const { features } = buildReadVsRefFeatures(
    makeFeature({
      refName: 'chrUn_scaffold1',
      start: 10,
      end: 60,
      strand: 1,
      CIGAR: '50M',
      flags: 0,
      name: 'r',
      tags: {},
    }),
    () => undefined,
  )
  expect(features[0]!.refName).toBe('chrUn_scaffold1')
})
