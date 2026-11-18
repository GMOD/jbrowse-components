import { SimpleFeature } from '@jbrowse/core/util'

import { recordsByBlock } from './executeVariantCellData.ts'

function record(id: string, start: number, end: number) {
  return {
    feature: new SimpleFeature({ id, data: { refName: 'ctgA', start, end } }),
    mostFrequentAlt: '1',
  }
}

const lookupRegions = [
  { refName: 'ctgA', start: 0, end: 10000, displayedRegionIndex: 0 },
]

const idsOf = (blocks: ReturnType<typeof recordsByBlock>, key: number) =>
  blocks.get(key)?.map(v => v.feature.id())

test('at genomic positions records paint longest first, then by start', () => {
  const blocks = recordsByBlock({
    layout: 'genomic',
    lookupRegions,
    filteredVariants: [
      record('snp', 150, 151),
      record('shortDel', 100, 400),
      record('laterLongDel', 200, 2000),
      record('sameStartCnv', 100, 2000),
      record('otherSnp', 50, 51),
    ],
  })
  expect(idsOf(blocks, 0)).toEqual([
    'sameStartCnv',
    'laterLongDel',
    'shortDel',
    'otherSnp',
    'snp',
  ])
})

test('records alike in span and start keep fetch order', () => {
  const alleleOrder = (filteredVariants: ReturnType<typeof record>[]) =>
    idsOf(
      recordsByBlock({ layout: 'genomic', lookupRegions, filteredVariants }),
      0,
    )
  const g = record('g', 300, 301)
  const t = record('t', 300, 301)
  expect(alleleOrder([g, t])).toEqual(['g', 't'])
  expect(alleleOrder([t, g])).toEqual(['t', 'g'])
})

test('in columns records keep the screen order they came in', () => {
  const filteredVariants = [
    record('laterSnp', 900, 901),
    record('longDel', 100, 2000),
  ]
  const blocks = recordsByBlock({
    layout: 'columns',
    lookupRegions,
    filteredVariants,
  })
  expect(idsOf(blocks, 0)).toEqual(['laterSnp', 'longDel'])
})
