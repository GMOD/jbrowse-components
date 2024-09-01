import { numToColName } from './util'

describe('num to col name', () => {
  const cases = [
    [10, 'K'],
    [26, 'AA'],
    [0, 'A'],
    [25, 'Z'],
    [27 * 26 - 1, 'ZZ'],
  ] as const

  cases.forEach(([input, output]) => {
    test(`${input} -> ${output}`, () => {
      expect(numToColName(input)).toBe(output)
    })
  })
})
