import { SimpleFeature } from '@jbrowse/core/util'

import { orderByScreenPosition } from './orderByScreenPosition.ts'

import type { Feature, Region } from '@jbrowse/core/util'

function feat(id: string, start: number, refName = 'chr17') {
  return new SimpleFeature({ id, data: { refName, start, end: start + 1 } })
}

function region(start: number, end: number, reversed = false): Region {
  return { refName: 'chr17', start, end, assemblyName: 'hg38', reversed }
}

const order = (features: Feature[], regions: Region[]) =>
  orderByScreenPosition(features, regions, f => f).map(f => f.id())

// TP53's exons, collapsed: the regions are fetched concurrently and merged, so
// the arrival order below deliberately interleaves them
const exon1 = feat('exon1-a', 7_675_900)
const exon1b = feat('exon1-b', 7_676_000)
const exon2 = feat('exon2-a', 7_674_100)
const exon2b = feat('exon2-b', 7_674_200)

test('orders by region, then position, in a forward view', () => {
  expect(
    order(
      [exon1b, exon2, exon1, exon2b],
      [region(7_674_000, 7_675_000), region(7_675_500, 7_676_500)],
    ),
  ).toEqual(['exon2-a', 'exon2-b', 'exon1-a', 'exon1-b'])
})

// the collapsed-introns view of a minus-strand gene: the regions descend and
// each is drawn right-to-left, so screen order descends throughout
test('descends inside a reversed region', () => {
  expect(
    order(
      [exon1b, exon2, exon1, exon2b],
      [region(7_675_500, 7_676_500, true), region(7_674_000, 7_675_000, true)],
    ),
  ).toEqual(['exon1-b', 'exon1-a', 'exon2-b', 'exon2-a'])
})

// what one global mirror of the column axis could not express, and the reason
// the matrix no longer has one
test('reflects each region onto itself when orientations are mixed', () => {
  expect(
    order(
      [exon1b, exon2, exon1, exon2b],
      [region(7_674_000, 7_675_000, true), region(7_675_500, 7_676_500, false)],
    ),
  ).toEqual(['exon2-b', 'exon2-a', 'exon1-a', 'exon1-b'])
})

test('takes the regions array order, not the arrival order of the runs', () => {
  // both runs arrive ascending and the lower-coordinate one arrives first, which
  // is what merge() actually did; the view draws the higher one on the left
  expect(
    order(
      [exon2, exon2b, exon1, exon1b],
      [region(7_675_500, 7_676_500), region(7_674_000, 7_675_000)],
    ),
  ).toEqual(['exon1-a', 'exon1-b', 'exon2-a', 'exon2-b'])
})

// Ranked by the FIRST region it overlaps, so a feature that spans a boundary
// still lands in one place on the axis rather than between the two.
test('ranks a feature spanning two regions by the first of them', () => {
  const span = feat('span', 7_674_500)
  expect(
    order(
      [exon1, span],
      [region(7_674_000, 7_675_000), region(7_675_500, 7_676_500)],
    ),
  ).toEqual(['span', 'exon1-a'])
})

test('keeps a feature that overlaps no region, after the placed ones', () => {
  expect(
    order([feat('offscreen', 1000), exon2], [region(7_674_000, 7_675_000)]),
  ).toEqual(['exon2-a', 'offscreen'])
})

test('is stable for features sharing a start', () => {
  expect(
    order(
      [feat('second', 7_674_100), feat('first', 7_674_100)],
      [region(7_674_000, 7_675_000)],
    ),
  ).toEqual(['second', 'first'])
})
