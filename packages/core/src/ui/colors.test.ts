import { categoricalPalette, categoricalValueColor } from './colors.ts'

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
