import { flipCigar, swapIndelCigar } from './cigarReorient.ts'

describe('flipCigar', () => {
  test('reverses token order and swaps D<->I', () => {
    expect(flipCigar('10M2D5M3I')).toBe('3D5M2I10M')
    expect(flipCigar('3M5D5M5I6M')).toBe('6M5D5M5I3M')
  })
  test('leaves M/=/X untouched while reversing', () => {
    expect(flipCigar('50=10X40M')).toBe('40M10X50=')
  })
  test('single token is unchanged except indel swap', () => {
    expect(flipCigar('100M')).toBe('100M')
    expect(flipCigar('7D')).toBe('7I')
  })
})

describe('swapIndelCigar', () => {
  test('swaps D<->I and leaves everything else / order alone', () => {
    expect(swapIndelCigar('10M2D5M3I')).toBe('10M2I5M3D')
  })
  test('no-op when there are no indels', () => {
    expect(swapIndelCigar('100M')).toBe('100M')
    expect(swapIndelCigar('50=10X40=')).toBe('50=10X40=')
  })
})
