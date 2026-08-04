import { SimpleFeature } from '@jbrowse/core/util'

import { orderByGenomicPosition } from './orderByGenomicPosition.ts'

import type { Feature, Region } from '@jbrowse/core/util'

function feat(id: string, start: number, refName = 'chr17') {
  return new SimpleFeature({ id, data: { refName, start, end: start + 1 } })
}

function region(start: number, end: number, refName = 'chr17'): Region {
  return { refName, start, end, assemblyName: 'hg38', reversed: true }
}

const order = (features: Feature[], regions: Region[]) =>
  orderByGenomicPosition(features, regions, f => f).map(f => f.id())

// TP53's exons, collapsed: six reversed regions fetched concurrently, so the
// arrival order below interleaves them
const exon1 = feat('exon1-a', 7_675_900)
const exon1b = feat('exon1-b', 7_676_000)
const exon2 = feat('exon2-a', 7_674_100)
const exon2b = feat('exon2-b', 7_674_200)

test('sorts an interleaved multi-region stream genomic-ascending', () => {
  expect(
    order(
      [exon1b, exon2, exon1, exon2b],
      [region(7_675_500, 7_676_500), region(7_674_000, 7_675_000)],
    ),
  ).toEqual(['exon2-a', 'exon2-b', 'exon1-a', 'exon1-b'])
})

test('dedupes a feature that arrived from two overlapping fetches', () => {
  const span = feat('span', 7_674_500)
  expect(order([span, exon2, span], [region(7_674_000, 7_675_000)])).toEqual([
    'exon2-a',
    'span',
  ])
})

test('orders refNames by where the view first names them', () => {
  expect(
    order(
      [feat('a', 100, 'chr9'), feat('b', 50, 'chr22'), feat('c', 10, 'chr9')],
      [region(0, 1000, 'chr9'), region(0, 1000, 'chr22')],
    ),
  ).toEqual(['c', 'a', 'b'])
})

test('puts a feature on an unnamed refName after the named ones', () => {
  expect(
    order([feat('other', 1, 'chrM'), exon2], [region(7_674_000, 7_675_000)]),
  ).toEqual(['exon2-a', 'other'])
})

test('is stable for features sharing a start', () => {
  expect(
    order(
      [feat('second', 7_674_100), feat('first', 7_674_100)],
      [region(7_674_000, 7_675_000)],
    ),
  ).toEqual(['second', 'first'])
})
