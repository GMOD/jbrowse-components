import {
  categoricalColor,
  categoricalPalette,
  categoricalValueColor,
} from './colors.ts'

test('a non-negative integer takes the palette slot it names, anchored at 1', () => {
  expect(categoricalValueColor('1')).toBe(categoricalPalette[0])
  expect(categoricalValueColor('2')).toBe(categoricalPalette[1])
  expect(categoricalValueColor('0')).toBe(categoricalPalette.at(-1))
})

test('any other value hashes into the palette and stays put', () => {
  const color = categoricalValueColor('chr7')
  expect(categoricalPalette).toContain(color)
  expect(categoricalValueColor('chr7')).toBe(color)
  expect(categoricalValueColor('')).toBe(categoricalPalette[0])
})

describe('categoricalColor', () => {
  it('spends the palette in domain order', () => {
    expect(categoricalColor('b', ['a', 'b'], ['red', 'blue'])).toBe('blue')
    expect(categoricalColor('b', ['a', 'b'])).toBe(categoricalPalette[1])
  })

  it('gives an unlisted value its own stable palette color', () => {
    expect(categoricalColor('z', ['a'])).toBe(categoricalValueColor('z'))
  })

  it('paints a missing value grey, and a list the way a group key joins it', () => {
    expect(categoricalColor(undefined)).toBe(categoricalColor(''))
    expect(categoricalPalette).not.toContain(categoricalColor(undefined))
    expect(categoricalColor(['a', 'b'], ['a,b'], ['red'])).toBe('red')
  })
})
