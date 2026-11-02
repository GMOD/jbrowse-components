import { recordsDrawnAlone } from './exportLinearView.ts'

describe('a variant display reads as its records', () => {
  test('as the records band states itself alone', () => {
    expect(
      recordsDrawnAlone({ recordsAlone: { height: 57, fits: true } }),
    ).toEqual({ height: 57, fits: true })
  })

  test('not while its rows draw', () => {
    expect(recordsDrawnAlone({ recordsAlone: undefined })).toBeUndefined()
  })

  test('not for a display with no records band', () => {
    expect(recordsDrawnAlone({ height: 100 })).toBeUndefined()
  })
})
