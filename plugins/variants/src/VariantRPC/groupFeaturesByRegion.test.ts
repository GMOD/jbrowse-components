import { SimpleFeature } from '@jbrowse/core/util'

import { groupFeaturesByRegion } from './groupFeaturesByRegion.ts'

import type { LookupRegion } from './groupFeaturesByRegion.ts'

function feat(id: string, refName: string, start: number, end: number) {
  return new SimpleFeature({ id, data: { refName, start, end } })
}

const ids = (features: { id(): string }[] | undefined) =>
  features?.map(f => f.id())

const region: LookupRegion = {
  refName: 'ctgA',
  start: 10000,
  end: 30000,
  displayedRegionIndex: 0,
}

test('keeps a feature that starts before the region but overlaps it', () => {
  const grouped = groupFeaturesByRegion(
    [feat('bigdel', 'ctgA', 1000, 51000), feat('snp', 'ctgA', 20000, 20001)],
    [region],
  )
  expect(ids(grouped.get(0))).toEqual(['bigdel', 'snp'])
})

test('drops a feature that only touches the region boundary', () => {
  const grouped = groupFeaturesByRegion(
    [
      feat('before', 'ctgA', 5000, 10000),
      feat('after', 'ctgA', 30000, 31000),
      feat('otherCtg', 'ctgB', 20000, 20001),
    ],
    [region],
  )
  expect(grouped.get(0)).toBeUndefined()
})

test('assigns a feature spanning two regions to the first one only', () => {
  const grouped = groupFeaturesByRegion(
    [feat('span', 'ctgA', 15000, 45000)],
    [
      region,
      { refName: 'ctgA', start: 40000, end: 50000, displayedRegionIndex: 1 },
    ],
  )
  expect(ids(grouped.get(0))).toEqual(['span'])
  expect(grouped.get(1)).toBeUndefined()
})

test('buckets by refName', () => {
  const grouped = groupFeaturesByRegion(
    [feat('a', 'ctgA', 20000, 20001), feat('b', 'ctgB', 20000, 20001)],
    [
      region,
      { refName: 'ctgB', start: 10000, end: 30000, displayedRegionIndex: 1 },
    ],
  )
  expect(ids(grouped.get(0))).toEqual(['a'])
  expect(ids(grouped.get(1))).toEqual(['b'])
})
