import { normalizeTrackLevels } from './initHelpers.ts'

describe('normalizeTrackLevels', () => {
  test('flat string[] is shorthand for a single level-0 list', () => {
    expect(normalizeTrackLevels(['a', 'b'])).toEqual([['a', 'b']])
  })

  test('string[][] is kept as one entry per level', () => {
    expect(normalizeTrackLevels([['a'], ['b', 'c']])).toEqual([
      ['a'],
      ['b', 'c'],
    ])
  })

  test('single-element flat list stays one level, not one-per-track', () => {
    expect(normalizeTrackLevels(['only'])).toEqual([['only']])
  })

  test('empty input yields no levels', () => {
    expect(normalizeTrackLevels([])).toEqual([])
  })
})
