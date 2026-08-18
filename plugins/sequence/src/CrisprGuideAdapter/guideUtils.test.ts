import { guideQuality, placeGuide } from './guideUtils.ts'

test('SpCas9 plus-strand: PAM 3prime, protospacer to the left, cut 3bp in', () => {
  // PAM NGG matched at 100..103, 20nt protospacer, blunt cut 3bp 5' of PAM
  const p = placeGuide({
    matchStart: 100,
    pamLength: 3,
    guideLength: 20,
    pamLocation: '3prime',
    cutOffset: 3,
    cutOffsetBottom: 3,
    strand: 1,
  })
  expect(p.pamStart).toBe(100)
  expect(p.pamEnd).toBe(103)
  expect(p.protoStart).toBe(80)
  expect(p.protoEnd).toBe(100)
  expect(p.featureStart).toBe(80)
  expect(p.featureEnd).toBe(103)
  expect(p.cutSite).toBe(97)
})

test('SpCas9 minus-strand: revcomp PAM at left, protospacer to the right', () => {
  const p = placeGuide({
    matchStart: 100,
    pamLength: 3,
    guideLength: 20,
    pamLocation: '3prime',
    cutOffset: 3,
    cutOffsetBottom: 3,
    strand: -1,
  })
  expect(p.pamStart).toBe(100)
  expect(p.pamEnd).toBe(103)
  expect(p.protoStart).toBe(103)
  expect(p.protoEnd).toBe(123)
  expect(p.featureStart).toBe(100)
  expect(p.featureEnd).toBe(123)
  // cut sits 3bp into the protospacer from its PAM-proximal (left) end
  expect(p.cutSite).toBe(106)
})

test('guideQuality computes GC percent and flags poly-T terminators', () => {
  expect(guideQuality('GGGGCCCCAAAATTTT')).toMatchObject({
    gcPercent: 50,
    hasPolyT: true,
  })
  expect(guideQuality('ACGTACGTAC')).toMatchObject({
    gcPercent: 50,
    hasPolyT: false,
  })
  expect(guideQuality('GCGCGC')).toMatchObject({ gcPercent: 100 })
  expect(guideQuality('')).toMatchObject({ gcPercent: 0, hasPolyT: false })
})

test('Cas12a plus-strand: PAM 5prime, protospacer to the right', () => {
  const p = placeGuide({
    matchStart: 200,
    pamLength: 4,
    guideLength: 23,
    pamLocation: '5prime',
    cutOffset: 18,
    cutOffsetBottom: 23,
    strand: 1,
  })
  expect(p.pamStart).toBe(200)
  expect(p.pamEnd).toBe(204)
  expect(p.protoStart).toBe(204)
  expect(p.protoEnd).toBe(227)
  // Cas12a cuts the two strands 5 bases apart, leaving a 5' overhang, so both
  // positions are reported rather than one blunt cut
  expect(p.cutSite).toBe(222)
  expect(p.cutSiteBottom).toBe(227)
})

// The fourth quadrant of placeGuide, and the reason `protoOnLeft` is a pair of
// clauses rather than plain `!isFivePrime`: a 5' PAM on the minus strand puts
// the protospacer at LOWER coordinates than the PAM, the mirror of the Cas12a
// plus-strand case above.
test('Cas12a minus-strand: PAM 5prime, protospacer to the left', () => {
  const p = placeGuide({
    matchStart: 200,
    pamLength: 4,
    guideLength: 23,
    pamLocation: '5prime',
    cutOffset: 18,
    cutOffsetBottom: 23,
    strand: -1,
  })
  expect(p.pamStart).toBe(200)
  expect(p.pamEnd).toBe(204)
  expect(p.protoStart).toBe(177)
  expect(p.protoEnd).toBe(200)
  expect(p.featureStart).toBe(177)
  expect(p.featureEnd).toBe(204)
  // both cuts run leftward from the PAM-proximal end, so the far one lands on
  // the protospacer's distal edge
  expect(p.cutSite).toBe(182)
  expect(p.cutSiteBottom).toBe(177)
})

test('a blunt cutter reports no second cut, rather than a duplicate position', () => {
  const p = placeGuide({
    matchStart: 100,
    pamLength: 3,
    guideLength: 20,
    pamLocation: '3prime',
    cutOffset: 3,
    cutOffsetBottom: 3,
    strand: 1,
  })
  expect(p.cutSite).toBe(97)
  expect(p.cutSiteBottom).toBeUndefined()
})
