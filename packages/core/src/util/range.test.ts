import { calculateRedispatchRange, intersection2 } from './range.ts'

describe('insersection2', () => {
  const testCases = [
    { in: [1, 3, 5, 10], out: [] },
    { in: [1, 1, 2, 2], out: [] },
    { in: [1, 2, 1, 2], out: [1, 2] },
    { in: [1, 3, 2, 4], out: [2, 3] },
    { in: [2, 4, 1, 3], out: [2, 3] },
    { in: [2, 4, 1, 4], out: [2, 4] },
    { in: [1, 4, 2, 4], out: [2, 4] },
    { in: [1, 3, 1, 4], out: [1, 3] },
    { in: [1, 4, 1, 3], out: [1, 3] },
    { in: [2, 3, 1, 2], out: [] },
    { in: [1, 2, 2, 3], out: [] },
    { in: [1, 1, 1, 1], out: [] },
    { in: [1, 1, 1, 2], out: [] },
    { in: [1, 2, 1, 1], out: [] },
    { in: [1, 3, 2, 2], out: [] },
    { in: [2, 2, 1, 3], out: [] },
  ] as const
  for (const testcase of testCases) {
    test(`intersection2(${testcase.in}) -> ${testcase.out}`, () => {
      // @ts-expect-error
      expect(intersection2(...testcase.in)).toEqual(testcase.out)
    })
  }
})

describe('calculateRedispatchRange', () => {
  const anything = () => true
  const notTyped = (t: string) => (f: { type: string }) => f.type !== t

  it('returns undefined when all features fit inside the query', () => {
    const features = [{ start: 10, end: 50, type: 'gene' }]
    expect(calculateRedispatchRange(features, anything, 0, 100)).toBeUndefined()
  })

  // coordinates come in interbase, already offset by @gmod/tabix: a feature
  // flush with the query edge is inside it and must not provoke a refetch
  it('returns undefined for a feature starting exactly at the query start', () => {
    const features = [{ start: 100, end: 150, type: 'gene' }]
    expect(
      calculateRedispatchRange(features, anything, 100, 200),
    ).toBeUndefined()
  })

  it('expands to feature bounds when a feature extends past the query', () => {
    const features = [
      { start: 10, end: 50, type: 'gene' },
      { start: 40, end: 200, type: 'mRNA' },
    ]
    expect(calculateRedispatchRange(features, anything, 60, 100)).toEqual({
      start: 10,
      end: 200,
    })
  })

  it('never returns a range narrower than the query', () => {
    // the gene extends left, but the right edge stays at the query end so a
    // dontRedispatch feature sitting at [150,200] still comes back
    const features = [{ start: 50, end: 120, type: 'gene' }]
    expect(calculateRedispatchRange(features, anything, 100, 200)).toEqual({
      start: 50,
      end: 200,
    })
  })

  it('ignores a line the predicate excludes when computing the range', () => {
    const features = [
      { start: 0, end: 100000, type: 'chromosome' },
      { start: 70, end: 90, type: 'gene' },
    ]
    // only the gene contributes; it fits, so no redispatch
    expect(
      calculateRedispatchRange(features, notTyped('chromosome'), 0, 100),
    ).toBeUndefined()
  })

  it('returns undefined when the predicate excludes every feature', () => {
    const features = [{ start: 0, end: 100000, type: 'chromosome' }]
    expect(
      calculateRedispatchRange(features, notTyped('chromosome'), 0, 100),
    ).toBeUndefined()
  })

  // The predicate is the whole point: what disqualifies a record is having no
  // children, and a type list can only approximate that. This is the NCBI shape
  // — a chromosome-long record of an unremarkable type, excluded because it
  // carries no ID for a Parent to reference.
  it('excludes a wide record on a property that is not its type', () => {
    const features = [
      { start: 0, end: 121976459, type: 'match', hasId: false },
      { start: 70, end: 90, type: 'gene', hasId: true },
    ]
    expect(
      calculateRedispatchRange(features, f => f.hasId, 0, 100),
    ).toBeUndefined()
  })
})
