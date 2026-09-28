import { annotationRank } from './laneAnnotation.ts'

test('a lane takes its annotation from more than GFF3', () => {
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

test('genes outrank repeats when one assembly declares both', () => {
  expect(annotationRank('Gff3TabixAdapter')).toBeLessThan(
    annotationRank('BedTabixAdapter')!,
  )
  expect(annotationRank('GtfAdapter')).toBeLessThan(
    annotationRank('BedAdapter')!,
  )
})
