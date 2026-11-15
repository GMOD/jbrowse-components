import { pairOrientation } from './util.ts'

test.each([
  ['an ordinary FR pair, forward mate', 99, 1000, 1200, 150, 'F1R2'],
  ['an ordinary FR pair, reverse mate', 147, 1200, 1000, 150, 'F1R2'],
  ['a dovetail, reverse read1 leftmost', 83, 3000, 3002, 150, 'F2R1'],
  ['a dovetail, forward read2', 163, 3002, 3000, 150, 'F2R1'],
  ['a tie, reverse read1', 83, 1876, 1876, 150, 'F2R1'],
  ['a tie, forward read2', 163, 1876, 1876, 150, 'F2R1'],
  ['a flagless tie, reverse mate', 19, 500, 500, 150, 'F1R2'],
  ['a flagless tie, forward mate', 35, 500, 500, 150, 'F2R1'],
  ['unequal lengths inside both, reverse mate', 83, 100, 150, 150, 'F2R1'],
  ['unequal lengths inside both, forward mate', 163, 150, 100, 100, 'F2R1'],
  ['unequal lengths, the accepted edge, reverse', 83, 100, 220, 150, 'F2R1'],
  ['unequal lengths, the accepted edge, forward', 163, 220, 100, 100, 'R1F2'],
  ['a tie with SEQ *, reverse read1', 83, 1876, 1876, 0, 'R1F2'],
  ['a tie with SEQ *, forward read2', 163, 1876, 1876, 0, 'R1F2'],
  ['no mate position, read1', 83, 3000, undefined, 150, 'R1F2'],
  ['no mate position, read2', 163, 3002, undefined, 150, 'R1F2'],
  ['same strand, leftmost read1', 65, 1000, 1100, 150, 'F1F2'],
  ['same strand, overlapping read2', 177, 1050, 1000, 150, 'R1R2'],
  ['true outward pair', 83, 1000, 1400, 150, 'R1F2'],
])('%s (flags %i)', (_, flags, start, matePos, seqLength, expected) => {
  expect(pairOrientation(flags, start, matePos, seqLength, true)).toBe(expected)
})

test.each([
  ['a mate on another reference', 99, false],
  ['an unmapped mate', 73, true],
])('%s has no orientation', (_, flags, sameReference) => {
  expect(pairOrientation(flags, 1000, 1200, 150, sameReference)).toBeUndefined()
})
