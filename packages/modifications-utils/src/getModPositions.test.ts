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
    unknownSkip: false,
    positions: [6, 17, 20, 31, 34],
    probStart: 0,
    probStride: 1,
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
    unknownSkip: true,
    positions: [6, 17, 20, 31, 34],
    probStart: 0,
    probStride: 1,
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
    unknownSkip: true,
    positions: [6, 17, 20, 31, 34],
    probStart: 0,
    probStride: 1,
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
    unknownSkip: false,
    positions: [6, 17, 20, 31, 34],
    probStart: 0,
    probStride: 1,
  })
})

// combined code 'C+mh' shares one set of positions across two types, and the
// ML probabilities are interleaved per position (m,h,m,h,...): 'm' reads ML at
// stride 2 from offset 0, 'h' at stride 2 from offset 1.
test('getModPositions combined code mh interleaves ML offsets', () => {
  const positions = getModPositions('C+mh,2,2,1', 'AGCTCTCCAGAGTCGNACGCC', 1)
  expect(positions[0]).toMatchObject({
    type: 'm',
    base: 'C',
    probStart: 0,
    probStride: 2,
  })
  expect(positions[1]).toMatchObject({
    type: 'h',
    base: 'C',
    probStart: 1,
    probStride: 2,
  })
  // both types map to the same read positions
  expect(positions[0]!.positions).toEqual(positions[1]!.positions)
})

// a second group's ML offset starts after the first group consumes
// numPositions * numTypes values (here C+mh,2,2 = 2 positions * 2 types = 4)
test('getModPositions second group ML offset accounts for combined first group', () => {
  const positions = getModPositions('C+mh,0,0;A+a,0', 'CGCGAA', 1)
  const a = positions.find(p => p.type === 'a')!
  expect(a.probStart).toBe(4)
  expect(a.probStride).toBe(1)
})
