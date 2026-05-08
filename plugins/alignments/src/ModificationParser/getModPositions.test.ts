import { getModPositions } from './getModPositions.ts'

test('getModPositions', () => {
  const positions = getModPositions(
    'C+m,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
    1,
  )
  expect(positions[0]).toEqual({
    type: 'm',
    base: 'C',
    strand: '+',
    positions: [6, 17, 20, 31, 34],
  })
})

// ? means "modification status of the skipped bases provided."
test('getModPositions with unknown (?)', () => {
  const positions = getModPositions(
    'C+m?,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
    1,
  )
  expect(positions[0]).toEqual({
    type: 'm',
    base: 'C',
    strand: '+',
    positions: [6, 17, 20, 31, 34],
  })
})

// uppercase single-letter modification code (uncharacterized per SAM spec), e.g. C+C?
test('getModPositions with uppercase mod code', () => {
  const positions = getModPositions(
    'C+C?,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
    1,
  )
  expect(positions[0]).toEqual({
    type: 'C',
    base: 'C',
    strand: '+',
    positions: [6, 17, 20, 31, 34],
  })
})

// reverse-strand reads: MM tag is interpreted against the complemented sequence
// (matching parse_mm.pl from hts-specs). C+m on a -1 strand looks for C's in
// revcom(fseq), i.e. G's in fseq, and emits positions from the right.
test('getModPositions reverse strand', () => {
  // fseq has G at indices 1,4,8 (revcom has C at 6,2,0 from left of revcom)
  // revcom("AGTAGTAAGT") = "ACTTACTACT"
  // C's in revcom at positions 0,4,7 (from left)
  // mapped back: seqLen - currPos = 10 - currPos
  const positions = getModPositions('C+m,0,0,0', 'AGTAGTAAGT', -1)
  expect(positions[0]?.positions).toEqual([1, 4, 8])
})

// . means "modification status of the skipped bases is low probability"
test('getModPositions with unknown (.)', () => {
  const positions = getModPositions(
    'C+m.,2,2,1,4,1',
    'AGCTCTCCAGAGTCGNACGCCATYCGCGCGCCACCA',
    1,
  )
  expect(positions[0]).toEqual({
    base: 'C',
    strand: '+',
    type: 'm',
    positions: [6, 17, 20, 31, 34],
  })
})
