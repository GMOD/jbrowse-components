import { ColorScheme } from './model.ts'

describe('ColorScheme', () => {
  test('has all expected color scheme indices', () => {
    expect(ColorScheme.normal).toBe(0)
    expect(ColorScheme.strand).toBe(1)
    expect(ColorScheme.mappingQuality).toBe(2)
    expect(ColorScheme.insertSize).toBe(3)
    expect(ColorScheme.firstOfPairStrand).toBe(4)
    expect(ColorScheme.pairOrientation).toBe(5)
    expect(ColorScheme.insertSizeAndOrientation).toBe(6)
    expect(ColorScheme.modifications).toBe(7)
    expect(ColorScheme.tag).toBe(8)
    expect(ColorScheme.baseQuality).toBe(9)
  })

  test('all indices are unique', () => {
    const values = Object.values(ColorScheme)
    expect(new Set(values).size).toBe(values.length)
  })
})
