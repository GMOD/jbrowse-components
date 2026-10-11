import {
  alignmentsSortConfigSchema,
  sortOf,
} from './alignmentsSortConfigSchema.ts'

const toChr = (refName: string) => (refName === '1' ? 'chr1' : refName)

function sortOfSnap(
  snap: Record<string, unknown> | string,
  fallbackRefName?: string,
) {
  return sortOf(alignmentsSortConfigSchema.create(snap), toChr, fallbackRefName)
}

test('a whole-window order is the layout order, with no column', () => {
  expect(sortOfSnap('spliced')).toEqual({
    layoutOrder: 'spliced',
    sortColumn: undefined,
  })
})

test('a column sort lays the rest out by position, on the canonical refName', () => {
  expect(sortOfSnap({ type: 'tag', tag: 'HP', pos: 99, refName: '1' })).toEqual(
    {
      layoutOrder: 'position',
      sortColumn: { type: 'tag', tag: 'HP', pos: 99, refName: 'chr1' },
    },
  )
})

test('a column missing its refName is no sort, unless a fallback stands in', () => {
  expect(sortOfSnap({ type: 'strand', pos: 5 }).sortColumn).toBeUndefined()
  expect(sortOfSnap({ type: 'strand', pos: 5 }, '1').sortColumn).toEqual({
    type: 'strand',
    pos: 5,
    refName: 'chr1',
    tag: undefined,
  })
})

test('a column missing its pos is no sort', () => {
  expect(
    sortOfSnap({ type: 'basePair', refName: 'chr1' }, 'chr1').sortColumn,
  ).toBeUndefined()
})
