import { parseStarFusionBreakpoint, starFusionColumns } from './starFusion.ts'

test('a 1-based breakpoint becomes an interbase feature', () => {
  expect(parseStarFusionBreakpoint('chr22:23290413:+', true)).toEqual({
    refName: 'chr22',
    start: 23290412,
    end: 23290413,
    strand: 1,
    mateDirection: -1,
  })
})

test('a + strand acceptor keeps its right, a - strand acceptor its left', () => {
  expect(parseStarFusionBreakpoint('chr9:130854064:+', false)).toMatchObject({
    mateDirection: 1,
  })
  expect(parseStarFusionBreakpoint('chr22:16808083:-', false)).toMatchObject({
    strand: -1,
    mateDirection: -1,
  })
})

test('a colon-bearing contig is read from the right', () => {
  expect(parseStarFusionBreakpoint('HLA-A*01:01:01:01:5000:+', true)).toEqual({
    refName: 'HLA-A*01:01:01:01',
    start: 4999,
    end: 5000,
    strand: 1,
    mateDirection: -1,
  })
})

test('a strandless breakpoint has no tick', () => {
  expect(parseStarFusionBreakpoint('chr1:100', true)).toMatchObject({
    refName: 'chr1',
    start: 99,
    strand: undefined,
    mateDirection: 0,
  })
})

test('the header keeps its first column name with or without #', () => {
  expect(
    starFusionColumns('#FusionName\tLeftBreakpoint\tRightBreakpoint'),
  ).toEqual(['FusionName', 'LeftBreakpoint', 'RightBreakpoint'])
  expect(
    starFusionColumns('FusionName\tLeftBreakpoint\tRightBreakpoint'),
  ).toEqual(['FusionName', 'LeftBreakpoint', 'RightBreakpoint'])
})

test('a header without the breakpoint columns names them', () => {
  expect(() => starFusionColumns('#chrom\tstart\tend')).toThrow(
    /no LeftBreakpoint or RightBreakpoint column/,
  )
})
