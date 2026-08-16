import {
  cigarWalkBp1,
  cigarWalkBp2,
  cigarWalkRev1,
  cigarWalkRev2,
} from './cigarWalkStart.ts'

// p11 -> p12 is the anchor in the DRAWN direction (the workers swap them for a
// reverse-strand feature); p21 -> p22 is the mate, always start -> end.
function walk(p11: number, p12: number, p21: number, p22: number, s: number) {
  return {
    bp1: cigarWalkBp1(p11, p12, s),
    bp2: cigarWalkBp2(p21, p22, s),
    rev1: cigarWalkRev1(p11, p12, s),
    rev2: cigarWalkRev2(p21, p22, s),
  }
}

test('a forward feature starts at the drawn corner', () => {
  expect(walk(100, 600, 20, 120, 1)).toEqual({
    bp1: 100,
    bp2: 20,
    rev1: 1,
    rev2: 1,
  })
})

// The one this exists for: the anchor lanes are already swapped, so the CIGAR's
// first op is at p12 (the anchor's start), not p11.
test('a reverse feature starts at the other end of both axes', () => {
  expect(walk(600, 100, 20, 120, -1)).toEqual({
    bp1: 100,
    bp2: 120,
    rev1: 1,
    rev2: -1,
  })
})

// Orientation is read off the endpoints, not assumed: a reversed displayed
// region lays out with cumBp decreasing, independently of strand.
test('a reversed anchor region flips rev1 without moving the start', () => {
  expect(walk(600, 100, 20, 120, 1)).toEqual({
    bp1: 600,
    bp2: 20,
    rev1: -1,
    rev2: 1,
  })
})

test('a reversed mate region flips rev2', () => {
  expect(walk(100, 600, 120, 20, 1)).toEqual({
    bp1: 100,
    bp2: 120,
    rev1: 1,
    rev2: -1,
  })
  // both reversals compose: reverse strand on a reversed mate region walks the
  // mate's cumBp upward again
  expect(walk(600, 100, 120, 20, -1)).toEqual({
    bp1: 100,
    bp2: 20,
    rev1: 1,
    rev2: 1,
  })
})

// Every case lands on the far corner after consuming a CIGAR that spans the
// block, which is what made the mirrored walk pass every endpoint assertion.
test('the walk always ends on the corner opposite its start', () => {
  for (const strand of [1, -1]) {
    for (const [p11, p12] of [
      [100, 600],
      [600, 100],
    ]) {
      for (const [p21, p22] of [
        [20, 120],
        [120, 20],
      ]) {
        const { bp1, bp2, rev1, rev2 } = walk(p11!, p12!, p21!, p22!, strand)
        expect(bp1 + 500 * rev1).toBe(bp1 === p11 ? p12 : p11)
        expect(bp2 + 100 * rev2).toBe(bp2 === p21 ? p22 : p21)
      }
    }
  }
})
