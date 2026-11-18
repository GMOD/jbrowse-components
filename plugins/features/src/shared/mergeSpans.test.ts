import { subtractSpans } from './mergeSpans.ts'

describe('subtractSpans', () => {
  it('keeps the stretches on either side of a cut', () => {
    expect(subtractSpans([[0, 100]], [[40, 60]])).toEqual([
      [0, 40],
      [60, 100],
    ])
  })

  it('keeps nothing of a span the cuts cover end to end', () => {
    expect(
      subtractSpans(
        [[0, 100]],
        [
          [0, 50],
          [50, 100],
        ],
      ),
    ).toEqual([])
  })

  it('merges overlapping spans and cuts before subtracting', () => {
    expect(
      subtractSpans(
        [
          [0, 60],
          [59, 100],
        ],
        [
          [10, 30],
          [20, 40],
          [90, 120],
        ],
      ),
    ).toEqual([
      [0, 10],
      [40, 90],
    ])
  })

  it('leaves a span no cut reaches', () => {
    expect(subtractSpans([[200, 300]], [[0, 100]])).toEqual([[200, 300]])
  })
})
