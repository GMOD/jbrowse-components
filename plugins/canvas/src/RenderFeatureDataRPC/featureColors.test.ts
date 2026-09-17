import { colorValueLabel, featureColorScale } from './featureColors.ts'

const settings = (
  colorField: string,
  colorDomain: string[] = [],
  colorPalette: string[] = [],
) => ({ colorField, colorDomain, colorPalette })

test('no field is no scale, and the color slot paints', () => {
  expect(featureColorScale(settings(''))).toBeUndefined()
})

test('a field scale carries its domain and palette as written', () => {
  expect(featureColorScale(settings('biotype', ['a'], ['red']))).toEqual({
    field: 'biotype',
    domain: ['a'],
    palette: ['red'],
  })
})

test("strand fills in its own colors, and yields each to one that's written", () => {
  expect(featureColorScale(settings('strand'))).toEqual({
    field: 'strand',
    domain: ['1', '-1', '0'],
    palette: ['tomato', 'cornflowerblue', 'goldenrod'],
  })
  expect(featureColorScale(settings('strand', [], ['red', 'blue']))).toEqual({
    field: 'strand',
    domain: ['1', '-1', '0'],
    palette: ['red', 'blue'],
  })
})

test('a strand value reads as the strand, any other value as itself', () => {
  expect(colorValueLabel('strand', '-1')).toBe('Reverse strand')
  expect(colorValueLabel('strand', '7')).toBe('7')
  expect(colorValueLabel('biotype', '1')).toBe('1')
})
