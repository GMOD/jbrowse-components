import { makeTicks } from './util'

describe('tick calculation', () => {
  test('one', () => {
    const result = Array.from(makeTicks(0, 10, 0.05))
    expect(result).toEqual([
      { type: 'major', base: -1, index: 0 },
      { type: 'minor', base: 0, index: 1 },
      { type: 'minor', base: 1, index: 2 },
      { type: 'minor', base: 2, index: 3 },
      { type: 'minor', base: 3, index: 4 },
      { type: 'minor', base: 4, index: 5 },
      { type: 'minor', base: 5, index: 6 },
      { type: 'minor', base: 6, index: 7 },
      { type: 'minor', base: 7, index: 8 },
      { type: 'minor', base: 8, index: 9 },
      { type: 'major', base: 9, index: 10 },
      { type: 'minor', base: 10, index: 11 },
    ])
  })
  test('two', () => {
    const result = Array.from(makeTicks(0, 50, 1))
    expect(result).toEqual([
      { type: 'major', base: -1, index: 0 },
      { type: 'minor', base: 19, index: 1 },
      { type: 'minor', base: 39, index: 2 },
      { type: 'minor', base: 59, index: 3 },
    ])
  })
})
