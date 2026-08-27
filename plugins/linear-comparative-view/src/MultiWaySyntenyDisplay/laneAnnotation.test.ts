import { annotationRank } from './laneAnnotation.ts'

test('a lane takes its annotation from more than GFF3', () => {
  // the four kinds a gene annotation actually arrives as
  expect(annotationRank('Gff3TabixAdapter')).toBe(0)
  expect(annotationRank('GtfTabixAdapter')).toBe(1)
  expect(annotationRank('BigBedAdapter')).toBe(2)
  expect(annotationRank('NCListAdapter')).toBe(3)
})

test('a track that is not annotation at all is no lane’s annotation', () => {
  for (const type of [
    'BamAdapter',
    'CramAdapter',
    'VcfTabixAdapter',
    'BigWigAdapter',
    'IndexedFastaAdapter',
    'MCScanBlocksAdapter',
    undefined,
  ]) {
    expect(annotationRank(type)).toBeUndefined()
  }
})

// The reason this ranks rather than matching a set: `hg38-genes` (Gff3Tabix)
// and `hg38-rmsk` (BedTabix) on one assembly is an ordinary config, and a flat
// widening would hand the lane whichever came first.
test('genes outrank repeats when one assembly declares both', () => {
  expect(annotationRank('Gff3TabixAdapter')).toBeLessThan(
    annotationRank('BedTabixAdapter')!,
  )
  expect(annotationRank('GtfAdapter')).toBeLessThan(
    annotationRank('BedAdapter')!,
  )
})
