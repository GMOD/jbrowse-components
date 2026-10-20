import {
  alignmentsSortConfigSchema,
  sortOf,
} from './alignmentsSortConfigSchema.ts'

const toChr = (refName: string) => (refName === '1' ? 'chr1' : refName)

function sortOfSnap(snap: Record<string, unknown>, fallbackRefName?: string) {
  return sortOf(alignmentsSortConfigSchema.create(snap), toChr, fallbackRefName)
}

test('a field is a sort field or a SAM tag, spelt as color and facet spell one', () => {
  expect(
    sortOfSnap({ field: 'tags.HP', pos: 1, refName: '1' }).sortColumn,
  ).toBeDefined()
  expect(() => sortOfSnap({ field: 'basePair' })).toThrow(
    /"basePair".*AlignmentsSortField \| SamTagField/,
  )
  expect(() => sortOfSnap({ field: 'tags.HAPLOTYPE' })).toThrow(/SamTagField/)
})

test('a whole-window order is the layout order, with no column', () => {
  expect(sortOfSnap({ field: 'spliced' })).toEqual({
    layoutOrder: 'spliced',
    sortColumn: undefined,
  })
})

test('a column sort lays the rest out by position, on the canonical refName', () => {
  expect(sortOfSnap({ field: 'tags.HP', pos: 99, refName: '1' })).toEqual({
    layoutOrder: 'position',
    sortColumn: { field: 'tags.HP', pos: 99, refName: 'chr1' },
  })
})

test('a column missing its refName is no sort, unless a fallback stands in', () => {
  expect(sortOfSnap({ field: 'strand', pos: 5 }).sortColumn).toBeUndefined()
  expect(sortOfSnap({ field: 'strand', pos: 5 }, '1').sortColumn).toEqual({
    field: 'strand',
    pos: 5,
    refName: 'chr1',
  })
})

test('a column missing its pos is no sort', () => {
  expect(
    sortOfSnap({ field: 'base', refName: 'chr1' }, 'chr1').sortColumn,
  ).toBeUndefined()
})
