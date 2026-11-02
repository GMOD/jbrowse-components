import { recordsDrawnAlone } from './exportLinearView.ts'

describe('a variant display reads as its records', () => {
  test('at their drawn height when no genotype row draws', () => {
    expect(
      recordsDrawnAlone({
        drawsRows: false,
        topBands: { reserved: { records: 57 } },
      }),
    ).toEqual({ height: 57, fits: false })
  })

  test('fitted into that height with its rows hidden', () => {
    expect(
      recordsDrawnAlone({
        drawsRows: false,
        rowsHidden: true,
        topBands: { reserved: { records: 57 } },
      }),
    ).toEqual({ height: 57, fits: true })
  })

  test('not while its rows draw', () => {
    expect(
      recordsDrawnAlone({
        drawsRows: true,
        topBands: { reserved: { records: 57 } },
      }),
    ).toBeUndefined()
  })

  test('not for a display with no records band', () => {
    expect(recordsDrawnAlone({ height: 100 })).toBeUndefined()
  })
})
