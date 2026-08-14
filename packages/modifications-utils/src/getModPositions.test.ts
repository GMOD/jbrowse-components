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
  // both types map to the same read positions — and to the SAME ARRAY, which is
  // a contract rather than an implementation detail: `forEachMaxProbMod` groups
  // the entries of one MM group by this identity so it walks the CIGAR once for
  // them, and would silently fall back to a walk per type if the walk here were
  // ever un-hoisted back into a per-type call.
  expect(positions[0]!.positions).toEqual(positions[1]!.positions)
  expect(positions[0]!.positions).toBe(positions[1]!.positions)
})

// The identity above must not extend ACROSS groups, however equal they look. Two
// groups are two walks, their entries carry different probStart bases, and a
// consumer grouping them as one would read the second group's probabilities from
// the first group's stride.
test('getModPositions gives each group its own positions array', () => {
  const positions = getModPositions('C+m,1;C+h,1', 'ACGCG', 1)
  expect(positions).toHaveLength(2)
  expect(positions[0]!.positions).toEqual(positions[1]!.positions)
  expect(positions[0]!.positions).not.toBe(positions[1]!.positions)
  expect(positions[0]!.probStart).toBe(0)
  expect(positions[1]!.probStart).toBe(1)
})

// a second group's ML offset starts after the first group consumes
// numPositions * numTypes values (here C+mh,2,2 = 2 positions * 2 types = 4)
test('getModPositions second group ML offset accounts for combined first group', () => {
  const positions = getModPositions('C+mh,0,0;A+a,0', 'CGCGAA', 1)
  const a = positions.find(p => p.type === 'a')!
  expect(a.probStart).toBe(4)
  expect(a.probStride).toBe(1)
})
