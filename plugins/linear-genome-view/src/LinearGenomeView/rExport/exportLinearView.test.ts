import { recordsDrawnAlone } from './exportLinearView.ts'

describe('a variant display reads as its records', () => {
  test('at their drawn height when no genotype row draws', () => {
    expect(
      recordsDrawnAlone({ drawsRows: false, topBands: { recordsHeight: 57 } }),
    ).toBe(57)
  })

  test('not while its rows draw', () => {
    expect(
      recordsDrawnAlone({ drawsRows: true, topBands: { recordsHeight: 57 } }),
    ).toBeUndefined()
  })

  test('not for a display with no records band', () => {
    expect(recordsDrawnAlone({ height: 100 })).toBeUndefined()
  })
})
