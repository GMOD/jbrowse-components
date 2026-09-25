import SimpleFeature from './simpleFeature.ts'
import { junctionEnds } from './svAlt.ts'

function vcf(alts: string[], info: Record<string, unknown[]> = {}) {
  return new SimpleFeature({
    uniqueId: 'v',
    refName: 'chr1',
    start: 999,
    end: 1000,
    ALT: alts,
    INFO: info,
  })
}

function paired(fields: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'p',
    refName: 'chr1',
    start: 10,
    end: 20,
    ...fields,
  })
}

test('a breakend reads both directions off its ALT', () => {
  expect(junctionEnds(vcf(['N[chr2:2000[']))).toEqual({
    own: { refName: 'chr1', pos: 999, keeps: -1 },
    mate: { refName: 'chr2', pos: 1999, keeps: 1 },
  })
})

test('a record with two alleles reads the one it is asked for', () => {
  const feature = vcf(['N[chr2:2000[', ']chr3:5000]N'])
  expect(junctionEnds(feature)?.mate.refName).toBe('chr2')
  expect(junctionEnds(feature, ']chr3:5000]N')?.mate).toEqual({
    refName: 'chr3',
    pos: 4999,
    keeps: -1,
  })
})

test('a deletion keeps the sequence outside it and a duplication the sequence inside', () => {
  expect(junctionEnds(vcf(['<DEL>'], { END: [1500] }))).toEqual({
    own: { refName: 'chr1', pos: 999, keeps: -1 },
    mate: { refName: 'chr1', pos: 1499, keeps: 1 },
  })
  const dup = junctionEnds(vcf(['<DUP:TANDEM>'], { END: [1500] }))
  expect([dup?.own.keeps, dup?.mate.keeps]).toEqual([1, -1])
})

test('a translocation takes its directions from STRANDS, and none without it', () => {
  const tra = (info: Record<string, unknown[]>) =>
    junctionEnds(vcf(['<TRA>'], { CHR2: ['chr5'], END: [300], ...info }))
  expect(tra({ STRANDS: ['+-'] })).toEqual({
    own: { refName: 'chr1', pos: 999, keeps: -1 },
    mate: { refName: 'chr5', pos: 299, keeps: 1 },
  })
  expect([tra({})?.own.keeps, tra({})?.mate.keeps]).toEqual([0, 0])
})

test('a BEDPE row puts each junction on the block edge its strand names', () => {
  expect(
    junctionEnds(
      paired({
        strand: 1,
        mate: { refName: 'chr2', start: 30, end: 40, strand: -1 },
      }),
    ),
  ).toEqual({
    own: { refName: 'chr1', pos: 19, keeps: -1 },
    mate: { refName: 'chr2', pos: 30, keeps: 1 },
  })
})

test('a stated direction outranks a strand', () => {
  const ends = junctionEnds(
    paired({
      strand: 1,
      mateDirection: 1,
      mate: { refName: 'chr2', start: 30, end: 40, strand: -1 },
    }),
  )
  expect(ends?.own).toEqual({ refName: 'chr1', pos: 10, keeps: 1 })
})

// PAF's strand is the query's orientation against the target, not a side of
// either block, and its mate states none.
test('a strand on one end only names no side, and the blocks face each other', () => {
  expect(
    junctionEnds(
      paired({ strand: -1, mate: { refName: 'chr1', start: 30, end: 40 } }),
    ),
  ).toEqual({
    own: { refName: 'chr1', pos: 19, keeps: 0 },
    mate: { refName: 'chr1', pos: 30, keeps: 0 },
  })
})

test('a record naming no other end has none', () => {
  expect(junctionEnds(vcf(['A']))).toBeUndefined()
  expect(junctionEnds(paired({}))).toBeUndefined()
})
