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

// The identity above DOES extend across groups, when the groups count the same
// base with the same deltas — which is what dorado emits (`C+h?;C+m?`, 5mC and
// 5hmC as two groups rather than the combined `C+mh`). The two walks would
// produce equal arrays element for element, so the second is skipped and both
// entries point at the first's.
//
// This reverses an earlier assertion here that each group must get its own
// array. The hazard that one named — "a consumer grouping them as one would read
// the second group's probabilities from the first group's stride" — is not in
// the code: `forEachMaxProbMod` reads `g.probStart`/`g.probStride` per ENTRY
// inside its group loop, never from the group's first entry. So probStart still
// distinguishes them, which the assertions below pin.
test('getModPositions shares one array between same-base groups', () => {
  const positions = getModPositions('C+m,1;C+h,1', 'ACGCG', 1)
  expect(positions).toHaveLength(2)
  expect(positions[0]!.positions).toEqual(positions[1]!.positions)
  expect(positions[0]!.positions).toBe(positions[1]!.positions)
  // shared array, separate ML windows: consecutive, not interleaved
  expect(positions[0]!.probStart).toBe(0)
  expect(positions[0]!.probStride).toBe(1)
  expect(positions[1]!.probStart).toBe(1)
  expect(positions[1]!.probStride).toBe(1)
})

// dorado's actual shape, and the one the merge is for: three groups, two of them
// on C. The C pair shares; the A group cannot and must not.
test('getModPositions shares only the same-base pair of A+a;C+h;C+m', () => {
  const mods = getModPositions('A+a.,0;C+h?,1;C+m?,1', 'ACGCG', 1)
  const [a, h, m] = mods
  expect(mods).toHaveLength(3)
  expect(h!.positions).toBe(m!.positions)
  expect(a!.positions).not.toBe(h!.positions)
  expect(a!.positions).toEqual([0])
  expect(h!.positions).toEqual([3])
  // the skip flag is per entry and survives the sharing
  expect(a!.unknownSkip).toBe(false)
  expect(h!.unknownSkip).toBe(true)
})

// Same base, DIFFERENT deltas: the arrays genuinely differ, so nothing is shared
// and the second group walks for itself.
test('getModPositions does not share when the deltas differ', () => {
  const mods = getModPositions('C+m,0;C+h,1', 'ACGCG', 1)
  expect(mods[0]!.positions).toEqual([1])
  expect(mods[1]!.positions).toEqual([3])
  expect(mods[0]!.positions).not.toBe(mods[1]!.positions)
})

// Same deltas, DIFFERENT base: equal text, different walks, different answers.
test('getModPositions does not share across bases', () => {
  const mods = getModPositions('C+m,0;A+a,0', 'ACGCG', 1)
  expect(mods[0]!.positions).toEqual([1])
  expect(mods[1]!.positions).toEqual([0])
  expect(mods[0]!.positions).not.toBe(mods[1]!.positions)
})

// The MM strand joins the key even though the walk does not read it, so a
// `C+m`/`C-m` pair is kept apart. Deliberately stronger than today's walk needs
// — the point is that the test cannot go stale if the walk becomes strand-aware.
test('getModPositions does not share across MM strands', () => {
  const mods = getModPositions('C+m,1;C-m,1', 'ACGCG', 1)
  expect(mods[0]!.positions).toEqual(mods[1]!.positions)
  expect(mods[0]!.positions).not.toBe(mods[1]!.positions)
})

// Reverse strand fills its arrays backwards from a preallocated length; sharing
// has to hand over the finished array, not one still being written.
test('getModPositions shares same-base groups on a reverse read', () => {
  const mods = getModPositions('C+m,0,0,0;C+h,0,0,0', 'AGTAGTAAGT', -1)
  expect(mods[0]!.positions).toEqual([1, 4, 8])
  expect(mods[1]!.positions).toBe(mods[0]!.positions)
  expect(mods[1]!.probStart).toBe(3)
})

// A combined code and a single-type group on the same base and deltas share too,
// and then carry three different ML windows into one CIGAR walk.
test('getModPositions shares between a combined code and a plain group', () => {
  const mods = getModPositions('C+mh,1;C+h,1', 'ACGCG', 1)
  expect(mods).toHaveLength(3)
  expect(mods[1]!.positions).toBe(mods[0]!.positions)
  expect(mods[2]!.positions).toBe(mods[0]!.positions)
  expect(mods[0]!).toMatchObject({ type: 'm', probStart: 0, probStride: 2 })
  expect(mods[1]!).toMatchObject({ type: 'h', probStart: 1, probStride: 2 })
  expect(mods[2]!).toMatchObject({ type: 'h', probStart: 2, probStride: 1 })
})

// a second group's ML offset starts after the first group consumes
// numPositions * numTypes values (here C+mh,2,2 = 2 positions * 2 types = 4)
test('getModPositions second group ML offset accounts for combined first group', () => {
  const positions = getModPositions('C+mh,0,0;A+a,0', 'CGCGAA', 1)
  const a = positions.find(p => p.type === 'a')!
  expect(a.probStart).toBe(4)
  expect(a.probStride).toBe(1)
})

// An MM tag may declare more calls of a base than the read has left. Every value
// emitted still has to be a valid index into the read: `getMethBins` indexes the
// sequence with these, and the CIGAR walk needs them ascending, so an
// out-of-range position is resolved to some real reference position rather than
// being dropped.
//
// This used to walk off the end. The do-while ran its body once per remaining
// call whatever currPos was, so a forward read emitted seqLength, seqLength + 1,
// … and a reverse read emitted negatives — only the FIRST unplaceable call
// landed in range. Found by `benches/mmDeltaJump.bench.ts --overrun`, because no
// read in any fixture overruns and nothing else exercised it.
test('getModPositions clamps every call past the end of a forward read', () => {
  // 'C' appears twice; the first delta asks for the 100th.
  const mods = getModPositions('C+m,99,0,0', 'ACGTACGT', 1)
  expect(mods[0]!.positions).toEqual([7, 7, 7])
})

test('getModPositions clamps every call past the end of a reverse read', () => {
  const mods = getModPositions('C+m,99,0,0', 'ACGTACGT', -1)
  expect(mods[0]!.positions).toEqual([0, 0, 0])
})

test('getModPositions keeps a clamped position inside a one-base read', () => {
  expect(getModPositions('C+m,5', 'A', 1)[0]!.positions).toEqual([0])
  expect(getModPositions('C+m,5', 'A', -1)[0]!.positions).toEqual([0])
})

// 'N' matches every base, so the forward walk resolves it by arithmetic instead
// of searching. It has to agree with the stepping form it replaced, including
// when it runs off the end.
test('getModPositions treats N as matching every base', () => {
  expect(getModPositions('N+m,0,1,0', 'ACGT', 1)[0]!.positions).toEqual([
    0, 2, 3,
  ])
  expect(getModPositions('N+m,9', 'ACGT', 1)[0]!.positions).toEqual([3])
})
