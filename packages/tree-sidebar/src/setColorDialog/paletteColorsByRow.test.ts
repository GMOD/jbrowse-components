import { paletteColorsByRow } from './applyColorPalette.ts'

const SOURCES = [
  { name: 'sample1', population: 'EUR' },
  { name: 'sample2', population: 'AFR' },
  { name: 'sample3', population: 'EUR' },
]

test('one color per distinct attribute value, aligned with the rows', () => {
  const colors = paletteColorsByRow(SOURCES, 'population')
  expect(colors).toHaveLength(3)
  expect(colors[0]).toBe(colors[2])
  expect(colors[0]).not.toBe(colors[1])
})

// An empty or unknown attribute falls back to `name`, so every row still gets
// a color of its own rather than none.
test.each(['', 'nonexistent'])('falls back to the name for %p', attribute => {
  const colors = paletteColorsByRow(SOURCES, attribute)
  expect(new Set(colors).size).toBe(3)
})

test('an empty row list gets an empty color list', () => {
  expect(paletteColorsByRow([], 'population')).toEqual([])
})

// A row missing the attribute is its own value ('' after String()), distinct
// from every real one.
test('a row without the attribute is colored apart from the rows with it', () => {
  const colors = paletteColorsByRow(
    [{ name: 'sample1', population: 'EUR' }, { name: 'sample2' }],
    'population',
  )
  expect(colors[0]).not.toBe(colors[1])
})
