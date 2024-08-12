import { intersection2 } from './range'

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
  testCases.forEach(testcase => {
    test(`intersection2(${testcase.in}) -> ${testcase.out}`, () => {
      // @ts-expect-error
      expect(intersection2(...testcase.in)).toEqual(testcase.out)
    })
  })
})
